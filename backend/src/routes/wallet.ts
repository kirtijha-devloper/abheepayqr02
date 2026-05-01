import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/wallet — get my wallet balance
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.userId! },
    });
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });
    res.json({ balance: Number(wallet.balance), eWalletBalance: Number(wallet.eWalletBalance) });
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

    // Withdrawals from Payout Wallet have NO fees as per new requirements
    const fee = 0;
    const totalDeduction = withdrawalAmount;

    // Check Payout Wallet (eWalletBalance)
    if (Number(wallet.eWalletBalance) < totalDeduction) {
      return res.status(400).json({ error: `Insufficient payout wallet balance. Available: ₹${Number(wallet.eWalletBalance).toFixed(2)}` });
    }

    const newEWalletBalance = Number(wallet.eWalletBalance) - totalDeduction;

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
          fromBalanceAfter: newBalance,
          toBalanceAfter: newBalance,
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

    res.json({ success: true, transaction: pTxn, feeCalculated: fee, totalDeducted: totalDeduction });
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

        if (req.userRole === "merchant") {
            const downlineProfiles = await prisma.profile.findMany({
                where: { parentId: req.userId! },
                select: { userId: true }
            });
            const downlineIds = downlineProfiles.map(p => p.userId);
            where.userId = { in: [...downlineIds, req.userId!] };
        }

        const settlements = await prisma.transaction.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: { user: { include: { profile: true } } }
        });

        res.json(settlements);
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

        if (req.userRole === "merchant" && txn.userId !== req.userId!) {
            const requesterProfile = await prisma.profile.findUnique({ where: { userId: txn.userId } });
            if (requesterProfile?.parentId !== req.userId!) {
                return res.status(403).json({ error: "You can only approve settlements for your own branches." });
            }
        }

        // Target to credit the fee: The Admin, OR the Merchant (if Merchant is approving downline)
        let feeTargetUserId = null;
        if (req.userRole === "admin" || req.userRole === "staff") {
            const adminRole = await prisma.userRole.findFirst({ where: { role: "admin" } });
            if (adminRole) feeTargetUserId = adminRole.userId;
        } else if (req.userRole === "merchant" && txn.userId !== req.userId!) {
            feeTargetUserId = req.userId; // the merchant themselves!
        }

        const targetWallet = feeTargetUserId ? await prisma.wallet.findUnique({ where: { userId: feeTargetUserId } }) : null;
        const charge = Number(txn.fee || 0);

        await prisma.$transaction(async (tx) => {
            await tx.transaction.update({
                where: { id },
                data: { status: "success" }
            });

            if (charge > 0 && targetWallet && feeTargetUserId) {
                const newBalance = Number(targetWallet.balance) + charge;
                await tx.wallet.update({
                    where: { userId: feeTargetUserId },
                    data: { balance: newBalance }
                });

                await tx.walletTransaction.create({
                    data: {
                        toUserId: feeTargetUserId,
                        fromUserId: txn.userId,
                        amount: charge,
                        type: "commission",
                        description: `Payout Fee for Txn ${txn.id.substring(0, 8)}`,
                        toBalanceAfter: newBalance,
                        createdBy: req.userId!
                    }
                });
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

export default router;
