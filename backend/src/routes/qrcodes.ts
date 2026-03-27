import { Router } from "express";
import { prisma } from "../index";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/auth";
import { decodeWithAI } from "../utils/aiDecoder";
import multer from "multer";
import path from "path";

const router = Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../../uploads/qrcodes"));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// GET /api/qrcodes — list all QR codes (admin sees all, merchant sees assigned to them)
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const roleRow = await prisma.userRole.findFirst({ where: { userId: req.userId! } });
    const isAdmin = roleRow?.role === "admin";

    const where: any = {};
    if (!isAdmin) {
      where.merchantId = req.userId!;
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

// POST /api/qrcodes — create a new QR code (admin only)
router.post("/", requireAuth, requireAdmin, upload.single("qrImage"), async (req: AuthRequest, res) => {
  const { label, upiId, mid, tid, merchantName, merchantId, type } = req.body;
  const imagePath = req.file ? `/uploads/qrcodes/${req.file.filename}` : null;
  
  try {
    const qr = await prisma.qrCode.create({
      data: {
        label,
        upiId,
        mid,
        tid,
        merchantName: merchantName || "Unassigned",
        merchantId,
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
router.patch("/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { label, upiId, mid, tid, merchantName, merchantId, status } = req.body;
  console.log(`PATCH QR ${id}:`, { label, upiId, mid, tid, merchantName, merchantId, status });
  try {
    const qr = await prisma.qrCode.update({
      where: { id },
      data: { label, upiId, mid, tid, merchantName, merchantId, status },
    });
    res.json(qr);
  } catch (e: any) {
    console.error(`PATCH QR ERROR for ID ${id}:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/qrcodes/:id — delete QR code (admin only)
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
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
router.post("/bulk", requireAuth, requireAdmin, upload.array("qrImages"), async (req: AuthRequest, res) => {
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
router.post("/assign-by-tid", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
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

// POST /api/qrcodes/assign-by-ids — Assign QR codes by their IDs (admin only)
router.post("/assign-by-ids", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const { ids, merchantId } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !merchantId) {
    return res.status(400).json({ error: "Missing ids array or merchantId" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: merchantId },
      include: { profile: true },
    });

    if (!user) return res.status(404).json({ error: "Merchant not found" });

    // Check if any of these IDs are already assigned to DIFFERENT merchants
    const alreadyAssignedToOthers = await prisma.qrCode.findMany({
        where: { 
            id: { in: ids },
            AND: [
                { NOT: { merchantId: null } },
                { NOT: { merchantId: merchantId } }
            ]
        }
    });

    if (alreadyAssignedToOthers.length > 0) {
        return res.status(400).json({ 
            error: `${alreadyAssignedToOthers.length} QR code(s) are already assigned to other merchants. Please unassign them first.` 
        });
    }

    const updated = await prisma.qrCode.updateMany({
      where: { id: { in: ids } },
      data: {
        merchantId: user.id,
        merchantName: user.profile?.fullName || user.email,
      },
    });

    // Notify the merchant
    if (updated.count > 0) {
      await prisma.notification.create({
        data: {
          userId: user.id,
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

// POST /api/qrcodes/:id/unassign — Unassign a QR code (admin or assigned merchant)
router.post("/:id/unassign", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const roleRow = await prisma.userRole.findFirst({ where: { userId: req.userId! } });
    const isAdmin = roleRow?.role === "admin";

    const qr = await prisma.qrCode.findUnique({ where: { id } });
    if (!qr) return res.status(404).json({ error: "QR Code not found" });

    if (!isAdmin && qr.merchantId !== req.userId) {
        return res.status(403).json({ error: "You are not authorized to unassign this QR code." });
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
