import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/transactions — get transactions (admin sees all)
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const { service, status, limit } = req.query;
  try {
    const roleRow = await prisma.userRole.findFirst({ where: { userId: req.userId! } });
    const isAdmin = roleRow?.role === "admin";

    const where: any = {};
    if (!isAdmin) {
      where.userId = req.userId!;
    }
    if (service) where.serviceType = service as string;
    if (status) where.status = status as string;

    const txns = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit ? parseInt(limit as string) : 50,
    });

    // Enrich with user names for admin
    if (isAdmin) {
      const userIds = [...new Set(txns.map(t => t.userId))];
      const profiles = await prisma.profile.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, fullName: true }
      });
      const roles = await prisma.userRole.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, role: true }
      });
      const nameMap = new Map(profiles.map(p => [p.userId, p.fullName]));
      const roleMap = new Map(roles.map(r => [r.userId, r.role]));

      const enriched = txns.map(t => ({
        ...t,
        userName: nameMap.get(t.userId) || "Unknown",
        userRole: roleMap.get(t.userId) || "Retailer"
      }));
      return res.json(enriched);
    }

    res.json(txns);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
