import { Router } from "express";
import { prisma } from "../index";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// POST /api/commission/process — auto-distribute commissions up hierarchy
router.post("/process", requireAuth, async (req: AuthRequest, res) => {
  const { service_key, transaction_amount } = req.body;
  if (!service_key || !transaction_amount || Number(transaction_amount) <= 0) {
    return res.status(400).json({ error: "service_key and positive transaction_amount required" });
  }

  const ROLE_HIERARCHY = ["retailer", "distributor", "master_distributor", "super_distributor", "admin"];

  try {
    // Get active slabs for this service
    const slabs = await prisma.commissionSlab.findMany({
      where: { serviceKey: service_key, isActive: true },
    });
    if (slabs.length === 0) return res.json({ message: "No slabs configured", commissions: [] });

    const slabMap = new Map(slabs.map(s => [s.role as string, s]));
    const results: { userId: string; role: string; commission: number }[] = [];

    // Walk up from the performer
    let currentUserId = req.userId!;
    const visited = new Set<string>();

    while (currentUserId && !visited.has(currentUserId)) {
      visited.add(currentUserId);

      const roleRow = await prisma.userRole.findFirst({ where: { userId: currentUserId } });
      if (!roleRow) break;

      const slab = slabMap.get(roleRow.role);
      if (slab) {
        const commissionAmount = slab.commissionType === "percent"
          ? Math.round((Number(transaction_amount) * Number(slab.commissionValue) / 100) * 100) / 100
          : Number(slab.commissionValue);

        if (commissionAmount > 0) {
          const wallet = await prisma.wallet.findUnique({ where: { userId: currentUserId } });
          const newBalance = Number(wallet?.balance ?? 0) + commissionAmount;

          await prisma.wallet.update({
            where: { userId: currentUserId },
            data: { balance: newBalance },
          });

          const txn = await prisma.walletTransaction.create({
            data: {
              toUserId: currentUserId,
              amount: commissionAmount,
              type: "commission",
              description: `Commission: ${slab.serviceLabel}`,
              toBalanceAfter: newBalance,
              createdBy: req.userId!,
              reference: `comm_${service_key}_${Date.now()}`,
            },
          });

          await prisma.commissionLog.create({
            data: {
              userId: currentUserId,
              slabId: slab.id,
              serviceKey: service_key,
              transactionAmount: Number(transaction_amount),
              commissionAmount,
              commissionType: slab.commissionType,
              commissionValue: Number(slab.commissionValue),
              credited: true,
              walletTxnId: txn.id,
            },
          });

          results.push({ userId: currentUserId, role: roleRow.role, commission: commissionAmount });
        }
      }

      // Walk up to parent
      const profile = await prisma.profile.findUnique({
        where: { userId: currentUserId },
        select: { parentId: true },
      });
      if (!profile?.parentId) break;

      const parentProfile = await prisma.profile.findUnique({
        where: { id: profile.parentId },
        select: { userId: true },
      });
      currentUserId = parentProfile?.userId || "";
    }

    res.json({ success: true, commissions: results });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/commission/slabs — get commission slabs
router.get("/slabs", requireAuth, async (_req, res) => {
  try {
    const slabs = await prisma.commissionSlab.findMany({
      where: { isActive: true },
      orderBy: [{ serviceKey: "asc" }, { role: "asc" }],
    });
    res.json(slabs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/commission/slabs/:id — update a global slab
router.patch("/slabs/:id", requireAuth, async (req: AuthRequest, res) => {
  const { commission_value, commission_type } = req.body;
  try {
    const updated = await prisma.commissionSlab.update({
      where: { id: req.params.id },
      data: {
        commissionValue: Number(commission_value),
        commissionType: commission_type,
      },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/commission/logs — get recent commission logs
router.get("/logs", requireAuth, async (req: AuthRequest, res) => {
  try {
    const logs = await prisma.commissionLog.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(logs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/commission/overrides — get user commission overrides
router.get("/overrides", requireAuth, async (req: AuthRequest, res) => {
  try {
    const overrides = await prisma.userCommissionOverride.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Enrich with target user names
    const userIds = Array.from(new Set(overrides.map(o => o.targetUserId)));
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, fullName: true },
    });
    const profileMap = new Map(profiles.map(p => [p.userId, p.fullName]));

    const enriched = overrides.map(o => ({
      ...o,
      target_user_id: o.targetUserId,
      target_name: profileMap.get(o.targetUserId) || "Unknown",
      service_key: o.serviceKey,
      service_label: o.serviceLabel,
      min_amount: o.minAmount,
      max_amount: o.maxAmount,
      commission_type: o.commissionType,
      commission_value: o.commissionValue,
      charge_type: o.chargeType,
      charge_value: o.chargeValue,
      is_active: o.isActive,
    }));

    res.json(enriched);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/commission/overrides — upsert an override slab
router.post("/overrides", requireAuth, async (req: AuthRequest, res) => {
  const { target_user_id, service_key, service_label, min_amount, max_amount, commission_type, commission_value, charge_type, charge_value } = req.body;
  try {
    const override = await prisma.userCommissionOverride.upsert({
      where: { 
        targetUserId_serviceKey_minAmount: { 
            targetUserId: target_user_id, 
            serviceKey: service_key,
            minAmount: Number(min_amount || 0)
        } 
      },
      create: {
        setBy: req.userId!,
        targetUserId: target_user_id,
        serviceKey: service_key,
        serviceLabel: service_label || service_key,
        minAmount: Number(min_amount || 0),
        maxAmount: Number(max_amount || 99999999),
        commissionType: commission_type || "flat",
        commissionValue: Number(commission_value || 0),
        chargeType: charge_type || "flat",
        chargeValue: Number(charge_value || 0),
        isActive: true,
      },
      update: {
        maxAmount: Number(max_amount || 99999999),
        commissionType: commission_type,
        commissionValue: Number(commission_value),
        chargeType: charge_type,
        chargeValue: Number(charge_value),
      },
    });
    res.json(override);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/commission/overrides/:id — remove an override
router.delete("/overrides/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    await prisma.userCommissionOverride.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
