import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { getAccessibleUserIds, getChargeDistribution, getEffectiveChargeConfig, roundCurrency } from "../utils/commission";

const router = Router();

// GET /api/wallet — get my wallet balance
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.userId! },
    });
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });
    res.json({ 
      balance: Number(wallet.balance), 
      eWalletBalance: Number(wallet.eWalletBalance),
      holdBalance: Number(wallet.holdBalance || 0)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/wallet/transactions — get wallet transaction history
router.get("/transactions", requireAuth, async (req: AuthRequest, res) => {
  try {
    const txns = await prisma.walletTransaction.findMany({
      where: {
        OR: [{ fromUserId: req.userId }, { toUserId: req.userId }],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(txns);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/wallet/top-up — admin top-up a user
router.post("/top-up", requireAuth, async (req: AuthRequest, res) => {
  const { to_user_id, amount, description } = req.body;
  try {
    if (req.userRole !== "admin" && !req.permissions?.canManageFinances) return res.status(403).json({ error: "Forbidden" });

    const toWallet = await prisma.wallet.findUnique({ where: { userId: to_user_id } });
    if (!toWallet) return res.status(404).json({ error: "User wallet not found" });

    const newBalance = Number(toWallet.balance) + Number(amount);
    const [, txn] = await prisma.$transaction([
      prisma.wallet.update({ where: { userId: to_user_id }, data: { balance: newBalance } }),
      prisma.walletTransaction.create({
        data: {
          toUserId: to_user_id,
          amount: Number(amount),
          type: "top_up",
          description: description || "Admin Top-up",
          toBalanceAfter: newBalance,
          createdBy: req.userId!,
        },
      }),
    ]);

    await prisma.notification.create({
      data: {
        userId: to_user_id,
        title: "Wallet Topped Up ✓",
        message: `Your wallet was topped up with ₹${amount}.`,
        type: "success",
      },
    });

    // Notify all admins about the top-up action (optional but good for audit)
    const admins = await prisma.user.findMany({
      where: { roles: { some: { role: 'admin' } } }
    });
    for (const admin of admins) {
        if (admin.id === req.userId) continue; // Don't notify self
        await prisma.notification.create({
            data: {
                userId: admin.id,
                title: "Top-up Processed",
                message: `Admin ${req.userId} topped up merchant ${to_user_id} with ₹${amount}.`,
                type: "info"
            }
        });
    }

    res.json(txn);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/wallet/transfer — transfer funds to downline
router.post("/transfer", requireAuth, async (req: AuthRequest, res) => {
  const { to_user_id, amount, description } = req.body;
  try {
    const fromWallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
    if (!fromWallet || Number(fromWallet.balance) < Number(amount)) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    const toWallet = await prisma.wallet.findUnique({ where: { userId: to_user_id } });
    if (!toWallet) return res.status(404).json({ error: "Recipient wallet not found" });

    const fromNewBalance = Number(fromWallet.balance) - Number(amount);
    const toNewBalance = Number(toWallet.balance) + Number(amount);

    const [, , txn] = await prisma.$transaction([
      prisma.wallet.update({ where: { userId: req.userId! }, data: { balance: fromNewBalance } }),
      prisma.wallet.update({ where: { userId: to_user_id }, data: { balance: toNewBalance } }),
      prisma.walletTransaction.create({
        data: {
          fromUserId: req.userId!,
          toUserId: to_user_id,
          amount: Number(amount),
          type: "transfer",
          description: description || "Fund Transfer",
          fromBalanceAfter: fromNewBalance,
          toBalanceAfter: toNewBalance,
          createdBy: req.userId!,
        },
      }),
    ]);

    await prisma.notification.create({
      data: {
        userId: to_user_id,
        title: "Funds Received",
        message: `You received ₹${amount} from your upline.`,
        type: "success",
      },
    });

    res.json(txn);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/wallet/pg-add — simulated PG add fund
router.post("/pg-add", requireAuth, async (req: AuthRequest, res) => {
  const { amount } = req.body;
  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
    const newBalance = Number(wallet?.balance ?? 0) + Number(amount);

    const [, txn] = await prisma.$transaction([
      prisma.wallet.update({ where: { userId: req.userId! }, data: { balance: newBalance } }),
      prisma.walletTransaction.create({
        data: {
          toUserId: req.userId!,
          amount: Number(amount),
          type: "pg_add",
          description: "Fund Added via Payment Gateway",
          toBalanceAfter: newBalance,
          createdBy: req.userId!,
        },
      }),
    ]);
    res.json(txn);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/wallet/bank-topup — admin self top-up via bank
router.post("/bank-topup", requireAuth, async (req: AuthRequest, res) => {
  const { amount, bank_reference, bank_name, description } = req.body;
  try {
    if (req.userRole !== "admin" && !req.permissions?.canManageFinances) return res.status(403).json({ error: "Forbidden" });

    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
    const newBalance = Number(wallet?.balance ?? 0) + Number(amount);

    const [, txn] = await prisma.$transaction([
      prisma.wallet.update({ where: { userId: req.userId! }, data: { balance: newBalance } }),
      prisma.walletTransaction.create({
        data: {
          toUserId: req.userId!,
          amount: Number(amount),
          type: "bank_deposit",
          description: `${description || "Bank Deposit"} - Ref: ${bank_reference} (${bank_name})`,
          toBalanceAfter: newBalance,
          createdBy: req.userId!,
        },
      }),
    ]);
    res.json(txn);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/wallet/e-wallet-credits — get e-wallet credits
router.get("/e-wallet-credits", requireAuth, async (req: AuthRequest, res) => {
  try {
    const credits = await prisma.eWalletCredit.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(credits);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/wallet/payout — merchant requests settlement to bank
router.post("/payout", requireAuth, async (req: AuthRequest, res) => {
  const { amount, bankAccountId } = req.body; // Requested withdrawal amount + selected bank
  const withdrawalAmount = Number(amount);

  if (!withdrawalAmount || withdrawalAmount <= 0) {
    return res.status(400).json({ error: "Invalid payout amount" });
  }

  if (!bankAccountId) {
    return res.status(400).json({ error: "Bank account is required for settlement" });
  }

  try {
    // Fetch user wallet
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });

    const payoutChargeConfig = await getEffectiveChargeConfig(prisma, {
      userId: req.userId!,
      serviceKey: "payout",
      amount: withdrawalAmount,
    });

    const fee = roundCurrency(payoutChargeConfig.chargeAmount);
    const totalDeduction = roundCurrency(withdrawalAmount + fee);

    // Check Payout Wallet (eWalletBalance)
    if (Number(wallet.eWalletBalance) < totalDeduction) {
      return res.status(400).json({ error: `Insufficient payout wallet balance. Available: ₹${Number(wallet.eWalletBalance).toFixed(2)}` });
    }

    const newEWalletBalance = roundCurrency(Number(wallet.eWalletBalance) - totalDeduction);

    // Fetch bank account details for snapshot
    const bankAccount = await (prisma as any).merchantBankAccount.findUnique({
        where: { id: bankAccountId, userId: req.userId! }
    });
    if (!bankAccount) return res.status(400).json({ error: "Selected bank account not found" });

    const bankDetailsSnapshot = JSON.stringify({
        bankName: bankAccount.bankName,
        accountName: bankAccount.accountName,
        accountNumber: bankAccount.accountNumber,
        ifscCode: bankAccount.ifscCode
    });

    const [, , pTxn] = await prisma.$transaction([
      prisma.wallet.update({ where: { userId: req.userId! }, data: { eWalletBalance: newEWalletBalance } }),
      prisma.walletTransaction.create({
        data: {
          toUserId: req.userId!,
          fromUserId: req.userId!,
          amount: -totalDeduction,
          type: "payout",
          description: `Settlement Request: ₹${withdrawalAmount} + Fee: ₹${fee.toFixed(2)}`,
          fromBalanceAfter: newEWalletBalance,
          toBalanceAfter: newEWalletBalance,
          createdBy: req.userId!,
        },
      }),
      (prisma as any).transaction.create({
        data: {
          userId: req.userId!,
          serviceType: "payout",
          type: "debit",
          amount: withdrawalAmount,
          fee: fee,
          description: `Settlement Request to ${bankAccount.bankName} (Fee: ₹${fee.toFixed(2)})`,
          status: "pending",
          payoutBankDetails: bankDetailsSnapshot
        }
      })
    ]);

    // Notify Merchant
    await prisma.notification.create({
        data: {
            userId: req.userId!,
            title: "Payout Initiated",
            message: `Your withdrawal of ₹${withdrawalAmount} is being processed. Total deducted: ₹${totalDeduction.toFixed(2)}.`,
            type: "info"
        }
    });

    // Notify all Admins
    const admins = await prisma.user.findMany({
        where: { roles: { some: { role: 'admin' } } }
    });
    for (const admin of admins) {
        await prisma.notification.create({
            data: {
                userId: admin.id,
                title: "New Payout Request",
                message: `Merchant ${req.userId} requested a payout of ₹${withdrawalAmount}.`,
                type: "warning"
            }
        });
    }

    res.json({
      success: true,
      transaction: pTxn,
      feeCalculated: fee,
      totalDeducted: totalDeduction,
      chargeSource: payoutChargeConfig.source,
      chargeType: payoutChargeConfig.chargeType,
      chargeValue: payoutChargeConfig.chargeValue,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/wallet/settlements — Admin/Merchant lists payout requests
router.get("/settlements", requireAuth, async (req: AuthRequest, res) => {
    try {
        const { status } = req.query;
        let where: any = { serviceType: "payout" };
        if (status) where.status = status as string;

        if (req.userRole === "master" || req.userRole === "merchant") {
            const accessibleUserIds = await getAccessibleUserIds(prisma, req.userId!);
            where.userId = { in: [req.userId!, ...accessibleUserIds] };
        } else if (req.userRole !== "admin" && req.userRole !== "staff") {
            where.userId = req.userId!;
        }

        const settlements = await prisma.transaction.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: { user: { include: { profile: true } } }
        });
        const viewerVisibleUserIds = req.userRole === "admin" || req.userRole === "staff"
            ? null
            : new Set(
                req.userRole === "master" || req.userRole === "merchant"
                    ? [req.userId!, ...(await getAccessibleUserIds(prisma, req.userId!))]
                    : [req.userId!]
            );

        const distributionUserIds = new Set<string>();
        const enriched = await Promise.all(settlements.map(async (txn) => {
            const amount = Number(txn.amount || 0);
            const preview = await getChargeDistribution(prisma, {
                userId: txn.userId,
                serviceKey: "payout",
                amount,
            });

            const actualDistTxns = txn.status === "success"
                ? await prisma.walletTransaction.findMany({
                    where: { reference: `settlement_charge_${txn.id}` },
                    orderBy: { createdAt: "asc" },
                })
                : [];

            const distributionSource = actualDistTxns.length > 0
                ? actualDistTxns.map((walletTxn) => ({
                    userId: walletTxn.toUserId,
                    amount: Number(walletTxn.amount || 0),
                }))
                : preview.distributions;

            distributionSource.forEach((dist) => distributionUserIds.add(dist.userId));

            return {
                ...txn,
                chargeAmount: actualDistTxns.length > 0
                    ? roundCurrency(actualDistTxns.reduce((sum, walletTxn) => sum + Number(walletTxn.amount || 0), 0))
                    : roundCurrency(Number(txn.fee || preview.totalCharge || 0)),
                totalDebit: roundCurrency(Number(txn.amount || 0) + Number(txn.fee || preview.totalCharge || 0)),
                chargeSource: preview.config.source,
                chargeType: preview.config.chargeType,
                chargeValue: preview.config.chargeValue,
                _distributionSource: distributionSource,
            };
        }));

        const profiles = await prisma.profile.findMany({
            where: { userId: { in: Array.from(distributionUserIds) } },
            select: { userId: true, fullName: true },
        });
        const roles = await prisma.userRole.findMany({
            where: { userId: { in: Array.from(distributionUserIds) } },
            select: { userId: true, role: true },
        });
        const profileMap = new Map(profiles.map((profile) => [profile.userId, profile.fullName]));
        const roleMap = new Map(roles.map((role) => [role.userId, role.role]));

        res.json(enriched.map((txn) => ({
            ...txn,
            chargeDistributions: txn._distributionSource
                .filter((dist: any) => !viewerVisibleUserIds || viewerVisibleUserIds.has(dist.userId))
                .map((dist: any) => ({
                    userId: dist.userId,
                    name: profileMap.get(dist.userId) || "Unknown",
                    role: roleMap.get(dist.userId) || "—",
                    amount: roundCurrency(Number(dist.amount || 0)),
                })),
            _distributionSource: undefined,
        })));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/wallet/settlements/:id/approve — Admin/Merchant approves payout
router.post("/settlements/:id/approve", requireAuth, async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
        const txn = await prisma.transaction.findUnique({ where: { id } });
        if (!txn || txn.status !== "pending") return res.status(400).json({ error: "Invalid transaction" });

        if ((req.userRole === "merchant" || req.userRole === "master") && txn.userId !== req.userId!) {
            const requesterProfile = await prisma.profile.findUnique({ where: { userId: txn.userId } });
            const approverProfile = await prisma.profile.findUnique({ where: { userId: req.userId! } });
            if (!requesterProfile?.parentId || requesterProfile.parentId !== approverProfile?.id) {
                return res.status(403).json({ error: "You can only approve settlements for your own direct downline." });
            }
        }

        const charge = Number(txn.fee || 0);
        const { distributions: chargeDistributions } = await getChargeDistribution(prisma, {
            userId: txn.userId,
            serviceKey: "payout",
            amount: Number(txn.amount || 0),
        });
        const chargeReference = `settlement_charge_${txn.id}`;

        await prisma.$transaction(async (tx) => {
            await tx.transaction.update({
                where: { id },
                data: { status: "success" }
            });

            if (charge > 0) {
                for (const dist of chargeDistributions) {
                    if (dist.amount <= 0) continue;
                    const targetWallet = await tx.wallet.findUnique({ where: { userId: dist.userId } });
                    if (!targetWallet) continue;

                    const newBalance = Number(targetWallet.balance) + dist.amount;
                    await tx.wallet.update({
                        where: { userId: dist.userId },
                        data: { balance: newBalance }
                    });

                    await tx.walletTransaction.create({
                        data: {
                            toUserId: dist.userId,
                            fromUserId: txn.userId,
                            amount: dist.amount,
                            type: "commission",
                            description: `Payout Fee for Txn ${txn.id.substring(0, 8)}`,
                            toBalanceAfter: newBalance,
                            createdBy: req.userId!,
                            reference: chargeReference
                        }
                    });
                }
            }

            await tx.notification.create({
                data: {
                    userId: txn.userId,
                    title: "Settlement Approved ✓",
                    message: `Your settlement request for ₹${txn.amount} has been approved and processed.`,
                    type: "success"
                }
            });
        });

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/wallet/settlements/:id/reject — Admin/Merchant rejects payout and refunds
router.post("/settlements/:id/reject", requireAuth, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    try {
        const txn = await prisma.transaction.findUnique({ where: { id } });
        if (!txn || txn.status !== "pending") return res.status(400).json({ error: "Invalid transaction" });

        if (req.userRole === "merchant" && txn.userId !== req.userId!) {
            const requesterProfile = await prisma.profile.findUnique({ where: { userId: txn.userId } });
            if (requesterProfile?.parentId !== req.userId!) {
                return res.status(403).json({ error: "You can only reject settlements for your own branches." });
            }
        }

        const walletTxn = await prisma.walletTransaction.findFirst({
            where: { 
                fromUserId: txn.userId, 
                type: "payout",
                createdAt: { gte: new Date(txn.createdAt.getTime() - 5000) }
            }
        });

        const refundAmount = walletTxn ? Math.abs(Number(walletTxn.amount)) : Number(txn.amount);

        const wallet = await prisma.wallet.findUnique({ where: { userId: txn.userId } });
        const newEWalletBalance = Number(wallet?.eWalletBalance || 0) + refundAmount;

        await prisma.$transaction([
            prisma.transaction.update({
                where: { id },
                data: { status: "failed", description: `Rejected: ${reason || "Admin rejection"}` }
            }),
            prisma.wallet.update({
                where: { userId: txn.userId },
                data: { eWalletBalance: newEWalletBalance }
            }),
            prisma.walletTransaction.create({
                data: {
                    toUserId: txn.userId,
                    amount: refundAmount,
                    type: "refund",
                    description: `Refund for Rejected Settlement - Ref: ${id.substring(0,8)}. Reason: ${reason || "Admin rejection"}`,
                    toBalanceAfter: newEWalletBalance,
                    createdBy: req.userId!
                }
            })
        ]);

        await prisma.notification.create({
            data: {
                userId: txn.userId,
                title: "Settlement Rejected ✗",
                message: `Your settlement request for ₹${txn.amount} was rejected. Reason: ${reason || "N/A"}. Funds refunded.`,
                type: "error"
            }
        });

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/wallet/hold — admin holds an amount from a user's wallet
router.post("/hold", requireAuth, async (req: AuthRequest, res) => {
  const { target_user_id, amount, description } = req.body;
  try {
    if (req.userRole !== "admin" && !req.permissions?.canManageFinances) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId: target_user_id } });
    if (!wallet) return res.status(404).json({ error: "User wallet not found" });

    const currentBalance = Number(wallet.balance);
    const holdAmount = Number(amount);

    if (currentBalance < holdAmount) {
        return res.status(400).json({ error: "Insufficient balance to hold this amount" });
    }

    const newBalance = roundCurrency(currentBalance - holdAmount);
    const newHoldBalance = roundCurrency(Number(wallet.holdBalance || 0) + holdAmount);

    const [, txn] = await prisma.$transaction([
      prisma.wallet.update({ 
        where: { userId: target_user_id }, 
        data: { 
            balance: newBalance,
            holdBalance: newHoldBalance
        } 
      }),
      prisma.walletTransaction.create({
        data: {
          toUserId: target_user_id,
          fromUserId: target_user_id,
          amount: -holdAmount,
          type: "hold",
          description: description || "Admin Hold Amount",
          fromBalanceAfter: newBalance,
          toBalanceAfter: newBalance,
          createdBy: req.userId!,
        },
      }),
    ]);

    await prisma.notification.create({
      data: {
        userId: target_user_id,
        title: "Amount Held 🔒",
        message: `An amount of ₹${amount} has been held in your wallet by Admin.`,
        type: "warning",
      },
    });

    res.json({ success: true, balance: newBalance, holdBalance: newHoldBalance });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/wallet/unhold — admin releases a held amount
router.post("/unhold", requireAuth, async (req: AuthRequest, res) => {
  const { target_user_id, amount, description } = req.body;
  try {
    if (req.userRole !== "admin" && !req.permissions?.canManageFinances) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId: target_user_id } });
    if (!wallet) return res.status(404).json({ error: "User wallet not found" });

    const currentHoldBalance = Number(wallet.holdBalance || 0);
    const unholdAmount = Number(amount);

    if (currentHoldBalance < unholdAmount) {
        return res.status(400).json({ error: "Cannot release more than the currently held amount" });
    }

    const newBalance = roundCurrency(Number(wallet.balance) + unholdAmount);
    const newHoldBalance = roundCurrency(currentHoldBalance - unholdAmount);

    const [, txn] = await prisma.$transaction([
      prisma.wallet.update({ 
        where: { userId: target_user_id }, 
        data: { 
            balance: newBalance,
            holdBalance: newHoldBalance
        } 
      }),
      prisma.walletTransaction.create({
        data: {
          toUserId: target_user_id,
          fromUserId: target_user_id,
          amount: unholdAmount,
          type: "unhold",
          description: description || "Admin Released Hold Amount",
          fromBalanceAfter: newBalance,
          toBalanceAfter: newBalance,
          createdBy: req.userId!,
        },
      }),
    ]);

    await prisma.notification.create({
      data: {
        userId: target_user_id,
        title: "Amount Released 🔓",
        message: `An amount of ₹${amount} has been released to your wallet by Admin.`,
        type: "success",
      },
    });

    res.json({ success: true, balance: newBalance, holdBalance: newHoldBalance });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
