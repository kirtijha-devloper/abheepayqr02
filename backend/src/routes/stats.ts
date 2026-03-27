import { Router } from "express";
import { prisma } from "../index";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/stats/retailer — get retailer dashboard stats
router.get("/retailer", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [earningsToday, transactionsToday, recentTxns] = await Promise.all([
      prisma.commissionLog.aggregate({
        where: { userId, createdAt: { gte: startOfDay } },
        _sum: { commissionAmount: true },
      }),
      prisma.transaction.count({
        where: { userId, createdAt: { gte: startOfDay } },
      }),
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);

    res.json({
      earningsToday: Number(earningsToday._sum.commissionAmount || 0),
      transactionsToday,
      recentTransactions: recentTxns,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
