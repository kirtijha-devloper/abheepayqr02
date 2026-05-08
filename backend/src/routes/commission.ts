import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requirePermission, AuthRequest } from "../middleware/auth";
import {
  getAccessibleUserIds,
  getEffectiveChargeConfig,
  isDescendantUser,
  roundCurrency,
} from "../utils/commission";

const router = Router();

const COMMISSION_MANAGER_ROLES = new Set(["admin", "staff", "master", "merchant"]);

function canManageGlobalSlabs(req: AuthRequest) {
  return req.userRole === "admin";
}

function canCreateGlobalSlabs(req: AuthRequest) {
  return req.userRole === "admin";
}

function canDeleteGlobalSlabs(req: AuthRequest) {
  return req.userRole === "admin";
}

function canManageHierarchyOverrides(req: AuthRequest) {
  return canManageGlobalSlabs(req) || req.userRole === "master" || req.userRole === "merchant";
}

function getAllowedTargetRolesForUser(req: AuthRequest) {
  if (canManageGlobalSlabs(req)) return ["master"];
  if (req.userRole === "master") return ["merchant"];
  if (req.userRole === "merchant") return ["branch"];
  return [];
}

async function findMatchingGlobalSlab(
  role: string,
  serviceKey: string,
  minAmount: number,
  maxAmount: number
) {
  return prisma.commissionSlab.findFirst({
    where: {
      role: role as any,
      serviceKey,
      isActive: true,
      minAmount,
      maxAmount,
    },
  });
}

// POST /api/commission/process — auto-distribute commissions up hierarchy
router.post("/process", requireAuth, async (req: AuthRequest, res) => {
  const { service_key, transaction_amount } = req.body;
  if (!service_key || !transaction_amount || Number(transaction_amount) <= 0) {
    return res.status(400).json({ error: "service_key and positive transaction_amount required" });
  }

  const ROLE_HIERARCHY = ["retailer", "distributor", "master_distributor", "super_distributor", "admin"];

  try {
    // Get active slabs for this service
    const results: { userId: string; role: string; commission: number }[] = [];

    // Walk up from the performer
    let currentUserId = req.userId!;
    const visited = new Set<string>();

    while (currentUserId && !visited.has(currentUserId)) {
      visited.add(currentUserId);

      const roleRow = await prisma.userRole.findFirst({ where: { userId: currentUserId } });
      if (!roleRow) break;

      const effectiveConfig = await getEffectiveChargeConfig(prisma, {
        userId: currentUserId,
        serviceKey: service_key,
        amount: Number(transaction_amount),
      });

      const commissionSlab =
        effectiveConfig.source === "global" && effectiveConfig.slabId
          ? await prisma.commissionSlab.findUnique({ where: { id: effectiveConfig.slabId } })
          : null;

      if (commissionSlab) {
        const commissionAmount = commissionSlab.commissionType === "percent"
          ? roundCurrency((Number(transaction_amount) * Number(commissionSlab.commissionValue)) / 100)
          : roundCurrency(Number(commissionSlab.commissionValue));

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
              description: `Commission: ${commissionSlab.serviceLabel}`,
              toBalanceAfter: newBalance,
              createdBy: req.userId!,
              reference: `comm_${service_key}_${Date.now()}`,
            },
          });

          await prisma.commissionLog.create({
            data: {
              userId: currentUserId,
              slabId: commissionSlab.id,
              serviceKey: service_key,
              transactionAmount: Number(transaction_amount),
              commissionAmount,
              commissionType: commissionSlab.commissionType,
              commissionValue: Number(commissionSlab.commissionValue),
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
      orderBy: [{ serviceKey: "asc" }, { role: "asc" }, { minAmount: "asc" }],
    });
    res.json(slabs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/commission/slabs — create a new global slab
router.post("/slabs", requireAuth, async (req: AuthRequest, res) => {
    const { role, service_key, min_amount, max_amount, commission_type, commission_value, charge_type, charge_value } = req.body;

    if (!canCreateGlobalSlabs(req)) {
        return res.status(403).json({ error: "Only admins or authorized staff can create new slabs." });
    }
    
    if (!role || !service_key) {
        return res.status(400).json({ error: "Role and service_key are required" });
    }

    try {
        console.log(`[Slabs] Incoming body:`, req.body);
        
        const n_min = Number(min_amount ?? 0);
        const n_max = Number(max_amount ?? 99999999);
        const n_cval = Number(charge_value ?? 0);
        const n_comm = Number(commission_value ?? 0);

        if (isNaN(n_min) || isNaN(n_max) || isNaN(n_cval) || isNaN(n_comm)) {
            return res.status(400).json({ error: "Invalid numeric values provided for amounts or charges" });
        }
        if (n_min < 0 || n_max <= n_min) {
            return res.status(400).json({ error: "Invalid slab range. Max amount must be greater than min amount." });
        }
        if (n_cval < 0 || n_comm < 0) {
            return res.status(400).json({ error: "Charge and commission values cannot be negative." });
        }

        const slab = await prisma.commissionSlab.create({
            data: {
                role: role as any,
                serviceKey: service_key,
                serviceLabel: service_key.charAt(0).toUpperCase() + service_key.slice(1),
                minAmount: n_min,
                maxAmount: n_max,
                commissionType: commission_type || "percent",
                commissionValue: n_comm,
                chargeType: charge_type || "flat",
                chargeValue: n_cval,
                isActive: true
            }
        });
        
        console.log(`[Slabs] Successfully created slab ID: ${slab.id}`);
        res.json(slab);
    } catch (e: any) {
        console.error(`[Slabs] Error creating slab:`, e);
        if (e.code === 'P2002') {
            return res.status(400).json({ error: "A slab with this Role and Min Amount already exists for this service." });
        }
        res.status(500).json({ error: e.message || "Failed to create commission slab" });
    }
});

// PATCH /api/commission/slabs/:id — update a global slab
router.patch("/slabs/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!canManageGlobalSlabs(req)) {
    return res.status(403).json({ error: "Only admins or authorized staff can update global slabs." });
  }
  const { commission_value, commission_type, charge_value, charge_type } = req.body;
  try {
    const data: any = {};
    if (commission_value !== undefined) data.commissionValue = Number(commission_value);
    if (commission_type !== undefined) data.commissionType = commission_type;
    if (charge_value !== undefined) data.chargeValue = Number(charge_value);
    if (charge_type !== undefined) data.chargeType = charge_type;

    if ((data.chargeValue !== undefined && (!Number.isFinite(data.chargeValue) || data.chargeValue < 0)) ||
        (data.commissionValue !== undefined && (!Number.isFinite(data.commissionValue) || data.commissionValue < 0))) {
      return res.status(400).json({ error: "Charge and commission values must be valid non-negative numbers." });
    }

    const updated = await prisma.commissionSlab.update({
      where: { id: req.params.id },
      data
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/commission/slabs/:id — remove a global slab
router.delete("/slabs/:id", requireAuth, async (req: AuthRequest, res) => {
    if (!canDeleteGlobalSlabs(req)) {
        return res.status(403).json({ error: "Only admins can delete slabs." });
    }
    try {
        await prisma.commissionSlab.delete({ where: { id: req.params.id } });
        res.json({ success: true });
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
    let where: any = {};

    if (canManageGlobalSlabs(req)) {
      where = {};
    } else if (req.userRole && COMMISSION_MANAGER_ROLES.has(req.userRole)) {
      const accessibleUserIds = await getAccessibleUserIds(prisma, req.userId!);
      where = { targetUserId: { in: accessibleUserIds } };
    } else {
      where = { targetUserId: req.userId! };
    }

    const overrides = await prisma.userCommissionOverride.findMany({
      where,
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

router.get("/downline-defaults", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!canManageHierarchyOverrides(req)) {
      return res.json([]);
    }

    const defaults = await prisma.downlineChargeDefault.findMany({
      where: canManageGlobalSlabs(req) ? {} : { ownerUserId: req.userId! },
      orderBy: [{ targetRole: "asc" }, { minAmount: "asc" }, { createdAt: "desc" }],
    });

    const ownerIds = Array.from(new Set(defaults.map((item) => item.ownerUserId)));
    const ownerProfiles = await prisma.profile.findMany({
      where: { userId: { in: ownerIds } },
      select: { userId: true, fullName: true },
    });
    const ownerMap = new Map(ownerProfiles.map((profile) => [profile.userId, profile.fullName]));

    res.json(
      defaults.map((item) => ({
        ...item,
        owner_user_id: item.ownerUserId,
        owner_name: ownerMap.get(item.ownerUserId) || "Unknown",
        service_key: item.serviceKey,
        service_label: item.serviceLabel,
        target_role: item.targetRole,
        commission_type: item.commissionType,
        commission_value: item.commissionValue,
        charge_type: item.chargeType,
        charge_value: item.chargeValue,
        min_amount: item.minAmount,
        max_amount: item.maxAmount,
        is_active: item.isActive,
      }))
    );
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/downline-defaults", requireAuth, async (req: AuthRequest, res) => {
  const { target_role, service_key, service_label, min_amount, max_amount, commission_type, commission_value, charge_type, charge_value } = req.body;

  if (!canManageHierarchyOverrides(req)) {
    return res.status(403).json({ error: "You are not allowed to manage downline defaults." });
  }

  const allowedRoles = getAllowedTargetRolesForUser(req);
  if (!target_role || !allowedRoles.includes(target_role)) {
    return res.status(400).json({ error: "Invalid target role for your hierarchy." });
  }

  try {
    const n_min = Number(min_amount ?? 0);
    const n_max = Number(max_amount ?? 99999999);
    const n_cval = Number(charge_value ?? 0);
    const n_comm = Number(commission_value ?? 0);

    if ([n_min, n_max, n_cval, n_comm].some((value) => Number.isNaN(value))) {
      return res.status(400).json({ error: "Invalid numeric values provided for amounts or charges" });
    }
    if (n_min < 0 || n_max <= n_min) {
      return res.status(400).json({ error: "Invalid default range. Max amount must be greater than min amount." });
    }
    if (n_cval < 0 || n_comm < 0) {
      return res.status(400).json({ error: "Charge and commission values cannot be negative." });
    }

    let effectiveMin = n_min;
    let effectiveMax = n_max;
    let effectiveChargeType = charge_type || "flat";

    if (!canManageGlobalSlabs(req)) {
      const matchingSlab = await findMatchingGlobalSlab(target_role, service_key || "payout", n_min, n_max);
      if (!matchingSlab) {
        return res.status(400).json({
          error: "Only admin can create or change slab ranges. Others must override the charge on an admin-created slab.",
        });
      }

      effectiveMin = Number(matchingSlab.minAmount);
      effectiveMax = Number(matchingSlab.maxAmount);
      effectiveChargeType = matchingSlab.chargeType || "flat";
    }

    const created = await prisma.downlineChargeDefault.upsert({
      where: {
        ownerUserId_targetRole_serviceKey_minAmount: {
          ownerUserId: req.userId!,
          targetRole: target_role,
          serviceKey: service_key || "payout",
          minAmount: effectiveMin,
        },
      },
      create: {
        ownerUserId: req.userId!,
        targetRole: target_role,
        serviceKey: service_key || "payout",
        serviceLabel: service_label || "Payout Downline Default",
        minAmount: effectiveMin,
        maxAmount: effectiveMax,
        commissionType: commission_type || "percent",
        commissionValue: n_comm,
        chargeType: effectiveChargeType,
        chargeValue: n_cval,
        isActive: true,
      },
      update: {
        maxAmount: effectiveMax,
        commissionType: commission_type || "percent",
        commissionValue: n_comm,
        chargeType: effectiveChargeType,
        chargeValue: n_cval,
        isActive: true,
      },
    });

    res.json(created);
  } catch (e: any) {
    if (e.code === "P2002") {
      return res.status(400).json({ error: "A default for this role and min amount already exists." });
    }
    res.status(500).json({ error: e.message || "Failed to save downline default" });
  }
});

router.delete("/downline-defaults/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.downlineChargeDefault.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Downline default not found" });

    if (!canManageGlobalSlabs(req) && existing.ownerUserId !== req.userId!) {
      return res.status(403).json({ error: "You can only delete your own downline defaults." });
    }

    await prisma.downlineChargeDefault.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/commission/overrides — upsert an override slab
router.post("/overrides", requireAuth, async (req: AuthRequest, res) => {
  const { target_user_id, service_key, service_label, min_amount, max_amount, commission_type, commission_value, charge_type, charge_value } = req.body;
  
  if (!target_user_id) return res.status(400).json({ error: "target_user_id is required" });
  if (!canManageHierarchyOverrides(req)) {
    return res.status(403).json({ error: "You are not allowed to manage charge overrides." });
  }

  try {
    console.log(`[Overrides] Incoming body:`, req.body);

    const n_min = Number(min_amount ?? 0);
    const n_max = Number(max_amount ?? 99999999);
    const n_cval = Number(charge_value ?? 0);
    const n_comm = Number(commission_value ?? 0);

    if (isNaN(n_min) || isNaN(n_max) || isNaN(n_cval) || isNaN(n_comm)) {
        return res.status(400).json({ error: "Invalid numeric values provided for amounts or charges" });
    }
    if (n_min < 0 || n_max <= n_min) {
      return res.status(400).json({ error: "Invalid override range. Max amount must be greater than min amount." });
    }
    if (n_cval < 0 || n_comm < 0) {
      return res.status(400).json({ error: "Charge and commission values cannot be negative." });
    }

    // Debug check: verify user exists
    const userExists = await prisma.user.findUnique({ where: { id: target_user_id } });
    if (!userExists) {
        console.error(`[Overrides] Target user ${target_user_id} not found.`);
        return res.status(400).json({ error: `Selected user (ID: ${target_user_id.substring(0,8)}...) does not exist in the database.` });
    }

    if (!canManageGlobalSlabs(req) && target_user_id !== req.userId!) {
      const allowed = await isDescendantUser(prisma, req.userId!, target_user_id);
      if (!allowed) {
        return res.status(403).json({ error: "You can only manage overrides for users in your own downline." });
      }
    }

    let effectiveMin = n_min;
    let effectiveMax = n_max;
    let effectiveChargeType = charge_type || "flat";

    if (!canManageGlobalSlabs(req)) {
      const actualTargetRole = (
        await prisma.userRole.findFirst({
          where: { userId: target_user_id },
          select: { role: true },
        })
      )?.role;
      const matchingSlab = actualTargetRole
        ? await findMatchingGlobalSlab(actualTargetRole, service_key, n_min, n_max)
        : null;

      if (!matchingSlab) {
        return res.status(400).json({
          error: "Only admin can create or change slab ranges. Others must override the charge on an admin-created slab.",
        });
      }

      effectiveMin = Number(matchingSlab.minAmount);
      effectiveMax = Number(matchingSlab.maxAmount);
      effectiveChargeType = matchingSlab.chargeType || "flat";
    }

    const override = await prisma.userCommissionOverride.upsert({
      where: { 
        targetUserId_serviceKey_minAmount: { 
            targetUserId: target_user_id, 
            serviceKey: service_key,
            minAmount: effectiveMin
        } 
      },
      create: {
        setBy: req.userId!,
        targetUserId: target_user_id,
        serviceKey: service_key,
        serviceLabel: service_label || service_key,
        minAmount: effectiveMin,
        maxAmount: effectiveMax,
        commissionType: commission_type || "flat",
        commissionValue: n_comm,
        chargeType: effectiveChargeType,
        chargeValue: n_cval,
        isActive: true,
      },
      update: {
        maxAmount: effectiveMax,
        commissionType: commission_type,
        commissionValue: n_comm,
        chargeType: effectiveChargeType,
        chargeValue: n_cval,
      },
    });
    console.log(`[Overrides] Successfully saved override ID: ${override.id}`);
    res.json(override);
  } catch (e: any) {
    console.error(`[Overrides] Error saving override:`, e);
    res.status(500).json({ error: e.message || "Failed to save override" });
  }
});

// DELETE /api/commission/overrides/:id — remove an override
router.delete("/overrides/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const override = await prisma.userCommissionOverride.findUnique({ where: { id: req.params.id } });
    if (!override) return res.status(404).json({ error: "Override not found" });

    if (!canManageHierarchyOverrides(req)) {
      return res.status(403).json({ error: "You are not allowed to delete charge overrides." });
    }

    if (!canManageGlobalSlabs(req) && override.targetUserId !== req.userId!) {
      const allowed = await isDescendantUser(prisma, req.userId!, override.targetUserId);
      if (!allowed) {
        return res.status(403).json({ error: "You can only delete overrides for users in your own downline." });
      }
    }

    await prisma.userCommissionOverride.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/resolve/:userId/:serviceKey", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { userId, serviceKey } = req.params;
    const amount = Number(req.query.amount ?? 0);

    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: "A valid non-negative amount is required." });
    }

    if (!canManageGlobalSlabs(req) && userId !== req.userId!) {
      const allowed = await isDescendantUser(prisma, req.userId!, userId);
      if (!allowed) {
        return res.status(403).json({ error: "You can only inspect effective charges for your own hierarchy." });
      }
    }

    const config = await getEffectiveChargeConfig(prisma, { userId, serviceKey, amount });
    res.json(config);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
