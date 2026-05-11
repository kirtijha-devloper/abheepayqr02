import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requirePermission, AuthRequest } from "../middleware/auth";
import { decodeWithAI } from "../utils/aiDecoder";
import { getAccessibleUserIds } from "../utils/commission";
import multer from "multer";
import path from "path";

const router = Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // On Vercel, we must use /tmp
        const dest = process.env.VERCEL 
            ? "/tmp" 
            : path.join(__dirname, "../../uploads/qrcodes");
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

const normalizeQrValue = (value: unknown) => String(value ?? "").trim().toLowerCase();

const getQrNumericTokens = (value: string) => {
  const normalized = normalizeQrValue(value);
  return normalized.match(/\d{6,16}/g) || [];
};

const getTransactionSearchBlob = (txn: any) => {
  const blobParts = [
    txn.refId,
    txn.clientRefId,
    txn.bankRef,
    txn.description,
    txn.sender,
    txn.consumer,
    txn.beneficiary,
    txn.category,
    txn.provider,
    txn.requestPayload ? JSON.stringify(txn.requestPayload) : "",
    txn.providerPayload ? JSON.stringify(txn.providerPayload) : "",
    txn.responsePayload ? JSON.stringify(txn.responsePayload) : "",
    txn.callbackPayload ? JSON.stringify(txn.callbackPayload) : "",
    txn.providerResponse ? JSON.stringify(txn.providerResponse) : "",
  ];

  return normalizeQrValue(blobParts.filter(Boolean).join(" "));
};

const transactionMatchesQr = (txn: any, qr: any) => {
  const blob = getTransactionSearchBlob(txn);
  const normalizedTid = normalizeQrValue(qr.tid);
  const normalizedUpi = normalizeQrValue(qr.upiId);
  const payloadQrId = normalizeQrValue(txn.requestPayload?.matchedQrId);
  const payloadTid = normalizeQrValue(txn.requestPayload?.qrTid || txn.providerPayload?.qrTid);
  const payloadUpi = normalizeQrValue(txn.requestPayload?.qrUpiId || txn.providerPayload?.qrUpiId);

  if (payloadQrId && payloadQrId === normalizeQrValue(qr.id)) return true;
  if (normalizedTid && payloadTid && payloadTid === normalizedTid) return true;
  if (normalizedUpi && payloadUpi && payloadUpi === normalizedUpi) return true;
  if (normalizedTid && blob.includes(normalizedTid)) return true;
  if (normalizedUpi && blob.includes(normalizedUpi)) return true;

  const numericTokens = [
    ...getQrNumericTokens(qr.tid),
    ...getQrNumericTokens(qr.upiId),
  ];

  return numericTokens.some((token) => blob.includes(token));
};

// GET /api/qrcodes — list all QR codes (admin sees all, merchant sees assigned to them or their branches)
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerId = req.userId!;
    const roleRow = await prisma.userRole.findFirst({ where: { userId: callerId } });
    const isAdmin = roleRow?.role === "admin" || (roleRow?.role === "staff" && req.permissions?.canManageServices);
    const isMerchant = roleRow?.role === "merchant";

    let where: any = {};
    if (!isAdmin) {
      if (isMerchant) {
        // Find own profile to find branches
        const myProfile = await prisma.profile.findUnique({ where: { userId: callerId } });
        if (myProfile) {
          // Find all branches (users whose profile.parentId is myProfile.id)
          const branches = await prisma.profile.findMany({
            where: { parentId: myProfile.id },
            select: { userId: true }
          });
          const branchUserIds = branches.map(b => b.userId);
          where.merchantId = { in: [callerId, ...branchUserIds] };
        } else {
          where.merchantId = callerId;
        }
      } else {
        // Branches or others only see their own
        where.merchantId = callerId;
      }
    }

    const qrs = await prisma.qrCode.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json(qrs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/assign-targets", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerId = req.userId!;
    const roleRow = await prisma.userRole.findFirst({ where: { userId: callerId } });
    const callerRole = roleRow?.role || null;
    const isServiceAdmin = callerRole === "admin" || (callerRole === "staff" && req.permissions?.canManageServices);

    if (isServiceAdmin) {
      const users = await prisma.user.findMany({
        where: {
          roles: {
            some: {
              role: { in: ["master", "merchant", "branch"] },
            },
          },
        },
        include: {
          profile: true,
          roles: true,
          wallet: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return res.json(
        users.map((user) => ({
          id: user.profile?.id || user.id,
          userId: user.id,
          fullName: user.profile?.fullName || user.profile?.businessName || user.email,
          businessName: user.profile?.businessName,
          email: user.email,
          phone: user.profile?.phone,
          status: user.profile?.status,
          role: user.roles[0]?.role || "",
          walletBalance: Number(user.wallet?.balance ?? 0),
        }))
      );
    }

    if (callerRole === "merchant") {
      const myProfile = await prisma.profile.findUnique({ where: { userId: callerId } });
      if (!myProfile) {
        return res.json([]);
      }

      const branches = await prisma.profile.findMany({
        where: {
          parentId: myProfile.id,
          user: {
            roles: {
              some: { role: "branch" },
            },
          },
        },
        include: {
          user: {
            include: {
              roles: true,
              wallet: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.json(
        branches.map((profile) => ({
          id: profile.id,
          userId: profile.userId,
          fullName: profile.fullName || profile.businessName || profile.user?.email,
          businessName: profile.businessName,
          email: profile.user?.email,
          phone: profile.phone,
          status: profile.status,
          role: profile.user?.roles?.[0]?.role || "branch",
          walletBalance: Number(profile.user?.wallet?.balance ?? 0),
        }))
      );
    }

    return res.json([]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/qrcodes/:id/report — QR-level report for visible inventory QR codes
router.get("/:id/report", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;

  try {
    const callerId = req.userId!;
    const roleRow = await prisma.userRole.findFirst({ where: { userId: callerId } });
    const role = roleRow?.role || null;
    const isServiceAdmin = role === "admin" || (role === "staff" && req.permissions?.canManageServices);

    const qr = await prisma.qrCode.findUnique({ where: { id } });
    if (!qr) {
      return res.status(404).json({ error: "QR code not found" });
    }

    let accessibleUserIds: string[] = [];
    if (!isServiceAdmin && (role === "master" || role === "merchant")) {
      accessibleUserIds = await getAccessibleUserIds(prisma, callerId);
    }

    const canAccessQr =
      isServiceAdmin ||
      (qr.merchantId &&
        [callerId, ...accessibleUserIds].includes(qr.merchantId));

    if (!canAccessQr) {
      return res.status(403).json({ error: "You are not allowed to view this QR report." });
    }

    const where: any = {
      serviceType: "qr_settlement",
    };

    if (!isServiceAdmin) {
      where.userId = { in: [callerId, ...accessibleUserIds] };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        status: true,
        refId: true,
        clientRefId: true,
        sender: true,
        consumer: true,
        description: true,
        createdAt: true,
        requestPayload: true,
        providerPayload: true,
        responsePayload: true,
        callbackPayload: true,
        providerResponse: true,
        userId: true,
      },
    });

    const matchedTransactions = transactions.filter((txn) => transactionMatchesQr(txn, qr));

    const dailyTotalsMap = new Map<string, { date: string; count: number; totalAmount: number }>();
    let totalAmount = 0;
    let completedAmount = 0;

    const rows = matchedTransactions.map((txn) => {
      const amount = Number(txn.amount || 0);
      const dateKey = txn.createdAt.toISOString().slice(0, 10);
      const existingDay = dailyTotalsMap.get(dateKey) || { date: dateKey, count: 0, totalAmount: 0 };
      existingDay.count += 1;
      existingDay.totalAmount += amount;
      dailyTotalsMap.set(dateKey, existingDay);

      totalAmount += amount;
      if (normalizeQrValue(txn.status) === "completed") {
        completedAmount += amount;
      }

      return {
        id: txn.id,
        amount,
        status: txn.status,
        refId: txn.refId,
        clientRefId: txn.clientRefId,
        sender: txn.sender,
        consumer: txn.consumer,
        description: txn.description,
        createdAt: txn.createdAt,
        reportDate: dateKey,
      };
    });

    res.json({
      qr: {
        id: qr.id,
        label: qr.label,
        tid: qr.tid,
        upiId: qr.upiId,
        merchantName: qr.merchantName,
        merchantId: qr.merchantId,
        status: qr.status,
      },
      summary: {
        totalTransactions: rows.length,
        totalAmount: Number(totalAmount.toFixed(2)),
        completedAmount: Number(completedAmount.toFixed(2)),
      },
      dailyTotals: Array.from(dailyTotalsMap.values())
        .map((item) => ({
          ...item,
          totalAmount: Number(item.totalAmount.toFixed(2)),
        }))
        .sort((a, b) => b.date.localeCompare(a.date)),
      transactions: rows,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/qrcodes — create a new QR code (admin only)
router.post("/", requireAuth, requirePermission("canManageServices"), upload.single("qrImage"), async (req: AuthRequest, res) => {
  const { label, upiId, mid, tid, merchantName, merchantId, type } = req.body;
  const imagePath = req.file ? `/uploads/qrcodes/${req.file.filename}` : null;
  
  try {
    const roleRow = await prisma.userRole.findFirst({ where: { userId: req.userId! } });
    const callerProfile = await prisma.profile.findUnique({ where: { userId: req.userId! } });
    const normalizedMerchantId = typeof merchantId === "string" && merchantId.trim() ? merchantId.trim() : null;

    const defaultOwnerId =
      roleRow?.role === "master" || roleRow?.role === "merchant"
        ? req.userId!
        : null;
    const finalMerchantId = normalizedMerchantId ?? defaultOwnerId;
    const finalMerchantName = finalMerchantId
      ? (finalMerchantId === req.userId!
          ? callerProfile?.fullName || "Assigned"
          : merchantName || "Assigned")
      : "Unassigned";

    const qr = await prisma.qrCode.create({
      data: {
        label,
        upiId,
        mid: mid || null,
        tid: tid || null,
        merchantName: finalMerchantName,
        merchantId: finalMerchantId,
        type: type || "single",
        status: "active",
        imagePath
      },
    });
    res.json(qr);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/qrcodes/:id — update QR code (admin only)
router.patch("/:id", requireAuth, requirePermission("canManageServices"), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { label, upiId, mid, tid, merchantName, merchantId, status } = req.body;
  try {
    const normalizedMerchantId = typeof merchantId === "string" && merchantId.trim() ? merchantId.trim() : undefined;
    const qr = await prisma.qrCode.update({
      where: { id },
      data: {
        label,
        upiId,
        mid: mid || null,
        tid: tid || null,
        merchantName,
        merchantId: merchantId !== undefined ? normalizedMerchantId ?? null : undefined,
        status
      },
    });
    res.json(qr);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/qrcodes/:id — delete QR code (admin only)
router.delete("/:id", requireAuth, requirePermission("canManageServices"), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.qrCode.delete({ where: { id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/qrcodes/rotate/:merchantId — get a random active QR for a merchant
router.get("/rotate/:merchantId", async (req, res) => {
  const { merchantId } = req.params;
  try {
    const qrs = await prisma.qrCode.findMany({
      where: {
        merchantId,
        status: "active"
      }
    });

    if (qrs.length === 0) {
      return res.status(404).json({ error: "No active QR codes found for this merchant." });
    }

    const randomIndex = Math.floor(Math.random() * qrs.length);
    res.json(qrs[randomIndex]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/qrcodes/bulk — Bulk create QR codes (admin only)
router.post("/bulk", requireAuth, requirePermission("canManageServices"), upload.array("qrImages"), async (req: AuthRequest, res) => {
  const { qrcodes: qrcodesJson } = req.body; // Array of QR code objects as JSON string
  const files = req.files as Express.Multer.File[];
  
  if (!qrcodesJson) return res.status(400).json({ error: "No metadata provided" });

  try {
    const qrcodes = JSON.parse(qrcodesJson);
    if (!Array.isArray(qrcodes)) return res.status(400).json({ error: "Invalid data format" });

    // Map files by original name for matching
    const fileMap = new Map();
    if (files) {
        files.forEach(f => fileMap.set(f.originalname, `/uploads/qrcodes/${f.filename}`));
    }

    const created = await prisma.qrCode.createMany({
      data: qrcodes.map((qr: any) => ({
        label: qr.label || "Bulk QR",
        upiId: qr.upiId,
        mid: qr.mid || null,
        tid: qr.tid || null,
        merchantName: qr.merchantName || "Unassigned",
        merchantId: qr.merchantId || null,
        type: "bulk",
        status: "active",
        imagePath: qr.originalName ? fileMap.get(qr.originalName) : null
      })),
      skipDuplicates: true,
    });
    res.json({ success: true, count: created.count || 0 });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/qrcodes/assign-by-tid — Assign QR code by TID or UPI ID (admin only)
router.post("/assign-by-tid", requireAuth, requirePermission("canManageServices"), async (req: AuthRequest, res) => {
  const { tid, merchantId } = req.body;
  if (!tid || !merchantId) return res.status(400).json({ error: "Missing tid or merchantId" });

  try {
    const user = await prisma.user.findUnique({
      where: { id: merchantId },
      include: { profile: true },
    });

    if (!user) return res.status(404).json({ error: "Merchant not found" });

    // Search by TID OR by UPI ID (either could be the identifier)
    // ONLY error if assigned to a DIFFERENT merchant
    const alreadyAssignedToOthers = await prisma.qrCode.findMany({
      where: { 
        OR: [{ tid }, { upiId: tid }],
        NOT: [
            { merchantId: null },
            { merchantId: merchantId }
        ]
      }
    });

    if (alreadyAssignedToOthers.length > 0) {
      return res.status(400).json({ 
        error: `Cannot assign: ${alreadyAssignedToOthers.length} QR code(s) found with this TID/UPI are already assigned to another merchant (${alreadyAssignedToOthers[0].merchantName}). Please unassign them first.` 
      });
    }

    const availableQrs = await prisma.qrCode.findMany({
        where: { OR: [{ tid }, { upiId: tid }] }
    });

    if (availableQrs.length === 0) {
      return res.status(404).json({ error: `No QR codes found with TID/UPI: ${tid}` });
    }

    const idsToUpdate = availableQrs.map(q => q.id);
    const updated = await prisma.qrCode.updateMany({
      where: { id: { in: idsToUpdate } },
      data: {
        merchantId: user.id,
        merchantName: user.profile?.fullName || user.email,
      },
    });

    // Notify the merchant about the assignment
    if (updated.count > 0) {
        await prisma.notification.create({
            data: {
                userId: user.id,
                title: "QR Codes Assigned",
                message: `${updated.count} QR code(s) with TID "${tid}" have been assigned to your account.`,
                type: "info"
            }
        });
    }

    res.json({ success: true, count: updated.count, updatedKeys: availableQrs.map(q => q.upiId) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/qrcodes/assign-by-ids — Any upline can assign their inventory QRs to their direct downline
router.post("/assign-by-ids", requireAuth, requirePermission("canManageServices"), async (req: AuthRequest, res) => {
  const { ids, merchantId } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !merchantId) {
    return res.status(400).json({ error: "Missing ids array or merchantId" });
  }

  try {
    const callerId = req.userId!;
    const roleRow = await prisma.userRole.findFirst({ where: { userId: callerId } });
    const isAdmin = roleRow?.role === "admin" || (roleRow?.role === "staff" && req.permissions?.canManageServices);

    const targetUser = await prisma.user.findUnique({
      where: { id: merchantId },
      include: { profile: true },
    });

    if (!targetUser) return res.status(404).json({ error: "Target user not found" });

    if (!isAdmin) {
      return res.status(403).json({ error: "Only admin can assign QR codes." });
    }

    const qrsToAssign = await prisma.qrCode.findMany({ where: { id: { in: ids } } });
    if (qrsToAssign.length !== ids.length) {
      return res.status(400).json({ error: "Some QR codes not found." });
    }

    const updated = await prisma.qrCode.updateMany({
      where: { id: { in: ids } },
      data: {
        merchantId: targetUser.id,
        merchantName: targetUser.profile?.fullName || targetUser.email,
      },
    });

    if (updated.count > 0) {
      await prisma.notification.create({
        data: {
          userId: targetUser.id,
          title: "QR Codes Assigned",
          message: `${updated.count} QR code(s) have been assigned to your account.`,
          type: "info",
        },
      });
    }

    res.json({ success: true, count: updated.count });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/qrcodes/my-downline — Get direct downline members of the caller
router.get("/my-downline", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerId = req.userId!;
    const roleRow = await prisma.userRole.findFirst({ where: { userId: callerId } });
    const isAdmin = roleRow?.role === "admin" || roleRow?.role === "master" || (roleRow?.role === "staff" && req.permissions?.canManageServices);

    if (isAdmin) {
      // Admins: return all users (they can assign to anyone)
      const allUsers = await prisma.profile.findMany({
        include: { user: { select: { id: true, email: true } } },
        orderBy: { fullName: 'asc' }
      });
      return res.json(allUsers.map(p => ({
        id: p.user?.id,
        userId: p.user?.id,
        fullName: p.fullName || p.user?.email,
        email: p.user?.email,
      })));
    }

    const myProfile = await prisma.profile.findUnique({ where: { userId: callerId } });
    if (!myProfile) return res.json([]);

    const downline = await prisma.profile.findMany({
      where: { parentId: myProfile.id },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { fullName: 'asc' }
    });

    res.json(downline.map(p => ({
      id: p.user?.id,
      userId: p.user?.id,
      fullName: p.fullName || p.user?.email,
      email: p.user?.email,
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/qrcodes/:id/unassign — Unassign a QR code (admin or assigned merchant)
router.post("/:id/unassign", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const roleRow = await prisma.userRole.findFirst({ where: { userId: req.userId! } });
    const isAdmin = roleRow?.role === "admin" || (roleRow?.role === "staff" && req.permissions?.canManageServices);

    const qr = await prisma.qrCode.findUnique({ where: { id } });
    if (!qr) return res.status(404).json({ error: "QR Code not found" });

    if (!isAdmin) {
        return res.status(403).json({ error: "Only admin can unassign this QR code." });
    }

    const updated = await prisma.qrCode.update({
      where: { id },
      data: {
        merchantId: null,
        merchantName: "Unassigned",
      },
    });

    res.json({ success: true, qr: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


export default router;
