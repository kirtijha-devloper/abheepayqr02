import { Prisma, PrismaClient } from "@prisma/client";

type TxClient = PrismaClient | Prisma.TransactionClient;

export type EffectiveChargeConfig = {
  source: "override" | "downline_default" | "global" | "none";
  userId: string;
  role: string | null;
  serviceKey: string;
  amount: number;
  chargeType: string;
  chargeValue: number;
  chargeAmount: number;
  overrideId?: string;
  downlineDefaultId?: string;
  downlineDefaultOwnerUserId?: string;
  slabId?: string;
};

export type ChargeDistribution = {
  userId: string;
  amount: number;
};

export type ChargeDistributionResult = {
  totalCharge: number;
  netAmount: number;
  config: EffectiveChargeConfig;
  distributions: ChargeDistribution[];
};

export function roundCurrency(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function calculateChargeAmount(amount: number, chargeType?: string | null, chargeValue?: number | string | null) {
  const numericAmount = Number(amount || 0);
  const numericValue = Number(chargeValue || 0);

  if (!Number.isFinite(numericAmount) || !Number.isFinite(numericValue) || numericAmount < 0 || numericValue < 0) {
    return 0;
  }

  if ((chargeType || "flat") === "percent") {
    return roundCurrency((numericAmount * numericValue) / 100);
  }

  return roundCurrency(numericValue);
}

export async function getUserRole(tx: TxClient, userId: string) {
  const roleRow = await tx.userRole.findFirst({ where: { userId } });
  return roleRow?.role || null;
}

export async function getProfileByUserId(tx: TxClient, userId: string) {
  return tx.profile.findUnique({ where: { userId } });
}

export async function isDescendantUser(tx: TxClient, ancestorUserId: string, targetUserId: string) {
  if (!ancestorUserId || !targetUserId || ancestorUserId === targetUserId) return false;

  const ancestorProfile = await tx.profile.findUnique({ where: { userId: ancestorUserId }, select: { id: true } });
  const targetProfile = await tx.profile.findUnique({ where: { userId: targetUserId }, select: { parentId: true } });

  if (!ancestorProfile || !targetProfile) return false;

  const visited = new Set<string>();
  let currentParentId = targetProfile.parentId;

  while (currentParentId && !visited.has(currentParentId)) {
    if (currentParentId === ancestorProfile.id) return true;
    visited.add(currentParentId);
    const parent = await tx.profile.findUnique({
      where: { id: currentParentId },
      select: { parentId: true },
    });
    currentParentId = parent?.parentId || null;
  }

  return false;
}

export async function getAccessibleUserIds(tx: TxClient, rootUserId: string) {
  const rootProfile = await tx.profile.findUnique({ where: { userId: rootUserId }, select: { id: true } });
  if (!rootProfile) return [];

  const queue = [rootProfile.id];
  const visited = new Set<string>(queue);
  const accessibleUserIds: string[] = [];

  while (queue.length) {
    const parentId = queue.shift()!;
    const children = await tx.profile.findMany({
      where: { parentId },
      select: { id: true, userId: true },
    });

    for (const child of children) {
      accessibleUserIds.push(child.userId);
      if (!visited.has(child.id)) {
        visited.add(child.id);
        queue.push(child.id);
      }
    }
  }

  return accessibleUserIds;
}

export function getAllowedDownlineRole(ownerRole?: string | null) {
  if (ownerRole === "admin" || ownerRole === "staff") return "master";
  if (ownerRole === "master") return "merchant";
  if (ownerRole === "merchant") return "branch";
  return null;
}

export async function getEffectiveChargeConfig(
  tx: TxClient,
  {
    userId,
    serviceKey,
    amount,
  }: {
    userId: string;
    serviceKey: string;
    amount: number;
  }
): Promise<EffectiveChargeConfig> {
  const numericAmount = Number(amount || 0);

  const override = await tx.userCommissionOverride.findFirst({
    where: {
      targetUserId: userId,
      serviceKey,
      isActive: true,
      minAmount: { lte: numericAmount },
      maxAmount: { gte: numericAmount },
    },
    orderBy: [{ minAmount: "desc" }, { createdAt: "desc" }],
  });

  if (override) {
    const chargeType = override.chargeType || "flat";
    const chargeValue = Number(override.chargeValue || 0);
    return {
      source: "override",
      userId,
      role: await getUserRole(tx, userId),
      serviceKey,
      amount: numericAmount,
      chargeType,
      chargeValue,
      chargeAmount: calculateChargeAmount(numericAmount, chargeType, chargeValue),
      overrideId: override.id,
    };
  }

  const role = await getUserRole(tx, userId);
  if (!role) {
    return {
      source: "none",
      userId,
      role: null,
      serviceKey,
      amount: numericAmount,
      chargeType: "flat",
      chargeValue: 0,
      chargeAmount: 0,
    };
  }

  const profile = await getProfileByUserId(tx, userId);
  const visited = new Set<string>();
  let currentParentId = profile?.parentId || null;

  while (currentParentId && !visited.has(currentParentId)) {
    visited.add(currentParentId);

    const parentProfile = await tx.profile.findUnique({
      where: { id: currentParentId },
      select: { userId: true, parentId: true },
    });
    if (!parentProfile) break;

    const downlineDefault = await tx.downlineChargeDefault.findFirst({
      where: {
        ownerUserId: parentProfile.userId,
        targetRole: role,
        serviceKey,
        isActive: true,
        minAmount: { lte: numericAmount },
        maxAmount: { gte: numericAmount },
      },
      orderBy: [{ minAmount: "desc" }, { createdAt: "desc" }],
    });

    if (downlineDefault) {
      const chargeType = downlineDefault.chargeType || "flat";
      const chargeValue = Number(downlineDefault.chargeValue || 0);
      return {
        source: "downline_default",
        userId,
        role,
        serviceKey,
        amount: numericAmount,
        chargeType,
        chargeValue,
        chargeAmount: calculateChargeAmount(numericAmount, chargeType, chargeValue),
        downlineDefaultId: downlineDefault.id,
        downlineDefaultOwnerUserId: parentProfile.userId,
      };
    }

    currentParentId = parentProfile.parentId || null;
  }

  const slab = await tx.commissionSlab.findFirst({
    where: {
      role,
      serviceKey,
      isActive: true,
      minAmount: { lte: numericAmount },
      maxAmount: { gte: numericAmount },
    },
    orderBy: [{ minAmount: "desc" }, { createdAt: "desc" }],
  });

  if (slab) {
    const chargeType = slab.chargeType || "flat";
    const chargeValue = Number(slab.chargeValue || 0);
    return {
      source: "global",
      userId,
      role,
      serviceKey,
      amount: numericAmount,
      chargeType,
      chargeValue,
      chargeAmount: calculateChargeAmount(numericAmount, chargeType, chargeValue),
      slabId: slab.id,
    };
  }

  return {
    source: "none",
    userId,
    role,
    serviceKey,
    amount: numericAmount,
    chargeType: "flat",
    chargeValue: 0,
    chargeAmount: 0,
  };
}

export async function getChargeDistribution(
  tx: TxClient,
  {
    userId,
    serviceKey,
    amount,
  }: {
    userId: string;
    serviceKey: string;
    amount: number;
  }
): Promise<ChargeDistributionResult> {
  const config = await getEffectiveChargeConfig(tx, { userId, serviceKey, amount });
  const totalCharge = roundCurrency(config.chargeAmount);
  const netAmount = roundCurrency(Number(amount) - totalCharge);
  const chargeByUser = new Map<string, number>();
  const requesterProfile = await getProfileByUserId(tx, userId);

  let currentProfile = requesterProfile;
  let currentChargeAmount = totalCharge;
  let lastAncestorUserId: string | null = null;
  const visited = new Set<string>();

  while (currentProfile?.parentId && !visited.has(currentProfile.parentId)) {
    visited.add(currentProfile.parentId);
    const parentProfile = await tx.profile.findUnique({ where: { id: currentProfile.parentId } });
    if (!parentProfile) break;

    lastAncestorUserId = parentProfile.userId;

    const parentChargeConfig = await getEffectiveChargeConfig(tx, {
      userId: parentProfile.userId,
      serviceKey,
      amount,
    });

    const parentChargeAmount = roundCurrency(parentChargeConfig.chargeAmount);
    const markupAmount = roundCurrency(currentChargeAmount - parentChargeAmount);

    if (markupAmount > 0) {
      chargeByUser.set(parentProfile.userId, roundCurrency((chargeByUser.get(parentProfile.userId) || 0) + markupAmount));
    }

    currentChargeAmount = Math.max(0, parentChargeAmount);
    currentProfile = parentProfile;
  }

  if (lastAncestorUserId && currentChargeAmount > 0) {
    chargeByUser.set(lastAncestorUserId, roundCurrency((chargeByUser.get(lastAncestorUserId) || 0) + currentChargeAmount));
  }

  return {
    totalCharge,
    netAmount,
    config,
    distributions: Array.from(chargeByUser.entries()).map(([distributionUserId, distributionAmount]) => ({
      userId: distributionUserId,
      amount: roundCurrency(distributionAmount),
    })),
  };
}
