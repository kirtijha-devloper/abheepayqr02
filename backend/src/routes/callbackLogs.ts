import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/callback-logs — get logs for current user (admin sees all)
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const roleRow = await prisma.userRole.findFirst({ where: { userId: req.userId! } });
    const isAdmin = roleRow?.role === "admin";

    const where: any = {};
    if (!isAdmin) {
      // Find transactions belonging to the user
      where.transaction = { userId: req.userId! };
    }

    const logs = await prisma.transactionCallbackLog.findMany({
      where,
      include: {
        transaction: {
            include: {
                user: {
                    select: {
                        email: true,
                        profile: {
                            select: {
                                fullName: true,
                                businessName: true
                            }
                        }
                    }
                }
            }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    res.json(logs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/callback-logs/resend/:id — re-trigger a callback
router.post("/resend/:transactionId", requireAuth, async (req: AuthRequest, res) => {
    const { transactionId } = req.params;
    try {
        const { triggerTransactionCallback } = await import("../utils/callback");
        await triggerTransactionCallback(transactionId);
        res.json({ success: true, message: "Callback re-queued" });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
