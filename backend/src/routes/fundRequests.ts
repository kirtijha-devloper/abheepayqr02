import { Router } from "express";
import { prisma } from "../index";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/fund-requests — get fund requests (my own + downline for admins/merchants/masters)
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const myRole = await prisma.userRole.findFirst({ where: { userId: req.userId! } });
    const myProfile = await prisma.profile.findUnique({ where: { userId: req.userId! } });
    let where: any = {};

    if (myRole?.role === "admin") {
      // Admin sees master-level requests only (their direct downline)
      const masterProfiles = await prisma.profile.findMany({
        where: { parentId: myProfile?.id },
        select: { userId: true }
      });
      const masterIds = masterProfiles.map(p => p.userId);
      where = { requesterId: { in: masterIds } };
    } else if (myRole?.role === "master") {
      // Master sees merchant requests (their direct downline)
      const merchantProfiles = await prisma.profile.findMany({
        where: { parentId: myProfile?.id },
        select: { userId: true }
      });
      const merchantIds = merchantProfiles.map(p => p.userId);
      where = { requesterId: { in: merchantIds } };
    } else if (myRole?.role === "merchant") {
      // Merchant sees branch requests (their direct downline)
      const branchProfiles = await prisma.profile.findMany({
        where: { parentId: myProfile?.id },
        select: { userId: true }
      });
      const branchIds = branchProfiles.map(p => p.userId);
      where = { requesterId: { in: branchIds } };
    } else {
      // Branch sees only their own requests
      where = { requesterId: req.userId! };
    }

    const requests = await prisma.fundRequest.findMany({
      where,
      include: {
        bankAccount: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Manually enrich with user names (since there's no direct relation in Prisma yet for requesterId to Profile)
    const userIds = new Set<string>();
    requests.forEach(r => {
      userIds.add(r.requesterId);
      if (r.approvedBy) userIds.add(r.approvedBy);
    });

    const profiles = await prisma.profile.findMany({
      where: { userId: { in: Array.from(userIds) } },
    });
    const roles = await prisma.userRole.findMany({
      where: { userId: { in: Array.from(userIds) } },
    });

    const profileMap = new Map(profiles.map(p => [p.userId, p]));
    const roleMap = new Map(roles.map(r => [r.userId, r.role]));

    const enriched = requests.map(r => ({
      ...r,
      requesterName: profileMap.get(r.requesterId)?.fullName || "Unknown",
      requesterRole: roleMap.get(r.requesterId) || "—",
      approverName: r.approvedBy ? profileMap.get(r.approvedBy)?.fullName || "—" : null,
      bankName: r.bankAccount?.bankName || "—",
    }));

    res.json(enriched);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/fund-requests — submit a new fund request
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { bank_account_id, amount, payment_mode, payment_reference, payment_date, remarks } = req.body;
  if (!amount) {
    return res.status(400).json({ error: "Amount is required" });
  }
  try {
    // Resolve bank account — use provided one, or the first active one, or none
    let resolvedBankAccountId = bank_account_id;
    if (!resolvedBankAccountId || resolvedBankAccountId === 'default') {
      const firstBank = await prisma.companyBankAccount.findFirst({ where: { isActive: true } });
      resolvedBankAccountId = firstBank?.id;
    }

    if (!resolvedBankAccountId) {
      return res.status(400).json({ error: "No active bank account found. Please contact admin." });
    }

    const request = await prisma.fundRequest.create({
      data: {
        requesterId: req.userId!,
        bankAccountId: resolvedBankAccountId,
        amount: Number(amount),
        paymentMode: payment_mode || "bank_transfer",
        paymentReference: payment_reference || `REQ-${Date.now()}`,
        paymentDate: payment_date ? new Date(payment_date) : new Date(),
        remarks: remarks || "Manual fund request",
      },
    });

    // Notify the DIRECT UPLINE (parent) of the requester
    const requesterProfile = await prisma.profile.findUnique({ where: { userId: req.userId! } });
    if (requesterProfile?.parentId) {
      // Find the user whose profile.id === requesterProfile.parentId
      const parentProfile = await prisma.profile.findUnique({ where: { id: requesterProfile.parentId } });
      if (parentProfile) {
        await prisma.notification.create({
          data: {
            userId: parentProfile.userId,
            title: "💰 New Fund Request",
            message: `Your downline has requested ₹${amount} in funds. Ref: ${request.id.slice(0, 8)}`,
            type: "warning",
          },
        });
      }
    } else {
      // No parent = requester is top-level, notify all admins
      const adminRoles = await prisma.userRole.findMany({ where: { role: "admin" } });
      for (const ar of adminRoles) {
        await prisma.notification.create({
          data: {
            userId: ar.userId,
            title: "💰 New Fund Request",
            message: `A user has requested ₹${amount}. Reference: ${request.id.slice(0, 8)}`,
            type: "warning",
          },
        });
      }
    }

    res.json(request);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/fund-requests/:id/approve — approve a fund request
router.patch("/:id/approve", requireAuth, async (req: AuthRequest, res) => {
  try {
    const fundReq = await prisma.fundRequest.findUnique({ where: { id: req.params.id } });
    if (!fundReq) return res.status(404).json({ error: "Not found" });

    const approverRole = await prisma.userRole.findFirst({ where: { userId: req.userId! } });
    const approverProfile = await prisma.profile.findUnique({ where: { userId: req.userId! } });

    // Non-admin/master must verify the requester is their direct downline
    if (approverRole?.role !== "admin") {
      const requesterProfile = await prisma.profile.findUnique({ where: { userId: fundReq.requesterId } });
      if (requesterProfile?.parentId !== approverProfile?.id) {
        return res.status(403).json({ error: "You can only approve requests from your direct downline." });
      }
    }

    // Check approver's wallet (non-admin must have funds)
    if (approverRole?.role !== "admin") {
      const approverWallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
      if (!approverWallet || Number(approverWallet.balance) < Number(fundReq.amount)) {
        return res.status(400).json({ error: "Insufficient wallet balance to approve this request." });
      }
    }

    await prisma.$transaction(async (tx) => {
      // Deduct from approver's wallet (except admin who tops up from system)
      if (approverRole?.role !== "admin") {
        const aWallet = await tx.wallet.findUnique({ where: { userId: req.userId! } });
        const aNewBal = Number(aWallet!.balance) - Number(fundReq.amount);
        await tx.wallet.update({ where: { userId: req.userId! }, data: { balance: aNewBal } });
        await tx.walletTransaction.create({
          data: {
            fromUserId: req.userId!,
            toUserId: fundReq.requesterId,
            amount: -Number(fundReq.amount),
            type: "fund_settlement",
            description: `Approved Fund Request from downline`,
            fromBalanceAfter: aNewBal,
            toBalanceAfter: 0, // will be updated below
            createdBy: req.userId!
          }
        });
      }

      // Credit wallet to requester
      const wallet = await tx.wallet.findUnique({ where: { userId: fundReq.requesterId } });
      const newBalance = Number(wallet?.balance ?? 0) + Number(fundReq.amount);

      await tx.wallet.update({
        where: { userId: fundReq.requesterId },
        data: { balance: newBalance },
      });

      await tx.walletTransaction.create({
        data: {
          toUserId: fundReq.requesterId,
          amount: Number(fundReq.amount),
          type: "fund_request",
          description: "Fund Request Approved",
          toBalanceAfter: newBalance,
          createdBy: req.userId!,
        },
      });

      await tx.fundRequest.update({
        where: { id: req.params.id },
        data: { status: "approved", approvedBy: req.userId!, approvedAt: new Date() },
      });
    });

    // Notify requester
    await prisma.notification.create({
      data: {
        userId: fundReq.requesterId,
        title: "Fund Request Approved ✓",
        message: `Your fund request of ₹${fundReq.amount} has been approved.`,
        type: "success",
      },
    });

    res.json({ success: true, txnId: txn.id, request: updatedReq });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/fund-requests/:id/reject — reject a fund request
router.patch("/:id/reject", requireAuth, async (req: AuthRequest, res) => {
  const { reason } = req.body;
  try {
    const fundReqCurrent = await prisma.fundRequest.findUnique({ where: { id: req.params.id } });
    if (!fundReqCurrent) return res.status(404).json({ error: "Not found" });

    const rejecterRole = await prisma.userRole.findFirst({ where: { userId: req.userId! } });
    const rejecterProfile = await prisma.profile.findUnique({ where: { userId: req.userId! } });

    if (rejecterRole?.role !== "admin") {
      const requesterProfile = await prisma.profile.findUnique({ where: { userId: fundReqCurrent.requesterId } });
      if (requesterProfile?.parentId !== rejecterProfile?.id) {
        return res.status(403).json({ error: "You can only reject requests from your direct downline." });
      }
    }

    const fundReq = await prisma.fundRequest.update({
      where: { id: req.params.id },
      data: { status: "rejected", rejectionReason: reason || "Not specified" },
    });

    await prisma.notification.create({
      data: {
        userId: fundReq.requesterId,
        title: "Fund Request Rejected",
        message: `Your fund request of ₹${fundReq.amount} was rejected. Reason: ${reason || "Not specified"}`,
        type: "error",
      },
    });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/fund-requests/bank-accounts — get active company bank accounts
router.get("/bank-accounts", requireAuth, async (_req, res) => {
  try {
    const accounts = await prisma.companyBankAccount.findMany({ where: { isActive: true } });
    res.json(accounts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/fund-requests/bank-accounts/all — get all company bank accounts (admin/merchant only)
router.get("/bank-accounts/all", requireAuth, async (req: AuthRequest, res) => {
  try {
    const roleRow = await prisma.userRole.findFirst({ where: { userId: req.userId! } });
    if (roleRow?.role !== "admin" && roleRow?.role !== "merchant") {
       return res.status(403).json({ error: "Forbidden" });
    }

    const accounts = await prisma.companyBankAccount.findMany({ orderBy: { createdAt: "asc" } });
    res.json(accounts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/fund-requests/bank-accounts — add a new bank account (admin only)
router.post("/bank-accounts", requireAuth, async (req: AuthRequest, res) => {
  const { bank_name, account_name, account_number, ifsc_code, upi_id } = req.body;
  try {
    const roleRow = await prisma.userRole.findFirst({ where: { userId: req.userId! } });
    if (roleRow?.role !== "admin") return res.status(403).json({ error: "Forbidden" });

    const account = await prisma.companyBankAccount.create({
      data: {
        bankName: bank_name,
        accountName: account_name,
        accountNumber: account_number,
        ifscCode: ifsc_code,
        upiId: upi_id || null,
        createdBy: req.userId!,
      },
    });
    res.json(account);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/fund-requests/bank-accounts/:id — update a bank account (admin only)
router.patch("/bank-accounts/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const roleRow = await prisma.userRole.findFirst({ where: { userId: req.userId! } });
    if (roleRow?.role !== "admin") return res.status(403).json({ error: "Forbidden" });

    const updated = await prisma.companyBankAccount.update({
      where: { id: req.params.id },
      data: {
        bankName: req.body.bank_name,
        accountName: req.body.account_name,
        accountNumber: req.body.account_number,
        ifscCode: req.body.ifsc_code,
        upiId: req.body.upi_id || null,
        isActive: req.body.is_active,
      },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/fund-requests/bank-accounts/:id/toggle — toggle bank account status
router.patch("/bank-accounts/:id/toggle", requireAuth, async (req: AuthRequest, res) => {
  try {
    const roleRow = await prisma.userRole.findFirst({ where: { userId: req.userId! } });
    if (roleRow?.role !== "admin") return res.status(403).json({ error: "Forbidden" });

    const bank = await prisma.companyBankAccount.findUnique({ where: { id: req.params.id } });
    if (!bank) return res.status(404).json({ error: "Not found" });

    const updated = await prisma.companyBankAccount.update({
      where: { id: req.params.id },
      data: { isActive: !bank.isActive },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
