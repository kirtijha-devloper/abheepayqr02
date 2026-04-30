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
      // Admin sees ALL pending and historical requests to approve/review
      where = {};
    } else {
      // Everyone else (Master, Merchant, Branch) sees only their own requests and status
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
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
    if (!wallet || Number(wallet.balance) < Number(amount)) {
      return res.status(400).json({ error: "Insufficient Main Wallet balance for this transfer request" });
    }

    const newBalance = Number(wallet.balance) - Number(amount);

    let request: any;
    await prisma.$transaction(async (tx) => {
        // Deduct balance immediately
        await tx.wallet.update({
            where: { userId: req.userId! },
            data: { balance: newBalance }
        });

        await tx.walletTransaction.create({
            data: {
                toUserId: req.userId!,
                amount: Number(amount),
                type: "transfer_hold",
                description: `Fund Request (Transfer to Payout) Hold`,
                toBalanceAfter: newBalance,
                createdBy: req.userId!
            }
        });

        request = await tx.fundRequest.create({
          data: {
            requesterId: req.userId!,
            amount: Number(amount),
            paymentMode: "wallet_transfer",
            remarks: remarks || "Main to Payout Transfer Request",
          },
        });
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

    if (approverRole?.role !== "admin") {
      return res.status(403).json({ error: "Only admins can approve transfer requests." });
    }

    let currentUserId = fundReq.requesterId;
    const chargeDistributions: { userId: string, amount: number }[] = [];

    // Find the slab applicable to the requester for this amount
    const requesterOverride = await prisma.userCommissionOverride.findFirst({
        where: { 
            targetUserId: fundReq.requesterId, 
            serviceKey: 'payout',
            minAmount: { lte: Number(fundReq.amount) },
            maxAmount: { gte: Number(fundReq.amount) }
        }
    });

    const baseChargeValue = requesterOverride?.chargeValue ? Number(requesterOverride.chargeValue) : 0;
    const baseChargeType = requesterOverride?.chargeType || "flat";

    const totalCharge = baseChargeType === "percent" 
        ? (Number(fundReq.amount) * baseChargeValue) / 100 
        : baseChargeValue;

    // Distribute totalCharge up the hierarchy based on differences
    let lastChargeRate = baseChargeValue;
    
    // We need a while loop walking up profile.parentId
    let profile = await prisma.profile.findUnique({ where: { userId: currentUserId } });
    
    while (profile?.parentId) {
        const parentProfile = await prisma.profile.findUnique({ where: { id: profile.parentId } });
        if (!parentProfile) break;
        
        const parentUserId = parentProfile.userId;
        
        // Find parent's charge rate for this specific amount range
        const parentOverride = await prisma.userCommissionOverride.findFirst({
             where: { 
                targetUserId: parentUserId, 
                serviceKey: 'payout',
                minAmount: { lte: Number(fundReq.amount) },
                maxAmount: { gte: Number(fundReq.amount) }
             }
        });
        
        const parentChargeRate = parentOverride?.chargeValue ? Number(parentOverride.chargeValue) : 0;
        
        // The parent earns the difference between what they charge the child, and what they pay their parent
        const markupRate = lastChargeRate - parentChargeRate;
        
        if (markupRate > 0) {
            const markupAmount = baseChargeType === "percent"
                ? (Number(fundReq.amount) * markupRate) / 100
                : markupRate;
                
            chargeDistributions.push({ userId: parentUserId, amount: markupAmount });
        }
        
        lastChargeRate = parentChargeRate;
        profile = parentProfile;
    }
    
    // The admin (at the top) gets the remaining lastChargeRate
    if (lastChargeRate > 0) {
        const adminAmount = baseChargeType === "percent"
            ? (Number(fundReq.amount) * lastChargeRate) / 100
            : lastChargeRate;
        // adminUserId is req.userId! since only admins can approve
        chargeDistributions.push({ userId: req.userId!, amount: adminAmount });
    }

    const netAmount = Number(fundReq.amount) - totalCharge;

    await prisma.$transaction(async (tx) => {
        // 1. Credit Net Amount to Requester's eWalletBalance
        const reqWallet = await tx.wallet.findUnique({ where: { userId: fundReq.requesterId } });
        const newEWalletBalance = Number(reqWallet?.eWalletBalance ?? 0) + netAmount;
        
        await tx.wallet.update({
            where: { userId: fundReq.requesterId },
            data: { eWalletBalance: newEWalletBalance }
        });

        await tx.walletTransaction.create({
            data: {
                toUserId: fundReq.requesterId,
                amount: netAmount,
                type: "transfer_credit",
                description: `Transfer Approved (Net after ₹${totalCharge.toFixed(2)} charge)`,
                toBalanceAfter: newEWalletBalance,
                createdBy: req.userId!
            }
        });

        // 2. Distribute Charges
        for (const dist of chargeDistributions) {
            const w = await tx.wallet.findUnique({ where: { userId: dist.userId } });
            if (w && dist.amount > 0) {
                const nBal = Number(w.balance) + dist.amount;
                await tx.wallet.update({
                    where: { userId: dist.userId },
                    data: { balance: nBal }
                });
                
                await tx.walletTransaction.create({
                    data: {
                        toUserId: dist.userId,
                        amount: dist.amount,
                        type: "commission",
                        description: `Payout Transfer Commission from ${fundReq.requesterId.substring(0,8)}`,
                        toBalanceAfter: nBal,
                        createdBy: req.userId!
                    }
                });
            }
        }

        // 3. Mark Approved
        await tx.fundRequest.update({
            where: { id: req.params.id },
            data: { status: "approved", approvedBy: req.userId!, approvedAt: new Date() },
        });
    });

    // Notify requester
    await prisma.notification.create({
      data: {
        userId: fundReq.requesterId,
        title: "Transfer Request Approved ✓",
        message: `Your transfer of ₹${fundReq.amount} to Payout Wallet was approved. (Charge: ₹${totalCharge.toFixed(2)})`,
        type: "success",
      },
    });

    res.json({ success: true, request: fundReq });
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
      return res.status(403).json({ error: "Only admins can reject transfer requests." });
    }

    let fundReq;
    await prisma.$transaction(async (tx) => {
        fundReq = await tx.fundRequest.update({
            where: { id: req.params.id },
            data: { status: "rejected", rejectionReason: reason || "Not specified" },
        });

        const reqWallet = await tx.wallet.findUnique({ where: { userId: fundReqCurrent.requesterId } });
        const newBalance = Number(reqWallet?.balance ?? 0) + Number(fundReqCurrent.amount);

        await tx.wallet.update({
            where: { userId: fundReqCurrent.requesterId },
            data: { balance: newBalance }
        });

        await tx.walletTransaction.create({
            data: {
                toUserId: fundReqCurrent.requesterId,
                amount: Number(fundReqCurrent.amount),
                type: "refund",
                description: `Refund for Rejected Transfer Request`,
                toBalanceAfter: newBalance,
                createdBy: req.userId!
            }
        });
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
