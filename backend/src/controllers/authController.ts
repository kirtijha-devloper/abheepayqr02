import { Request, Response } from "express";
import { prisma } from "../prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../utils/env";

const JWT_SECRET = getJwtSecret();
const ALL_STAFF_PAGES = [
  "dashboard",
  "transactions",
  "masters",
  "users",
  "wallet",
  "reconciliation",
  "qr_codes",
  "settlements",
  "fund_requests",
  "ledger",
  "reports",
  "callbacks",
  "support",
  "charges",
  "settings",
];
const FEATURE_ACCESS_DEFAULTS: Record<string, string[]> = {
  admin: [
    "dashboard",
    "transactions",
    "masters",
    "users",
    "wallet",
    "reconciliation",
    "qr_codes",
    "settlements",
    "fund_requests",
    "ledger",
    "reports",
    "callbacks",
    "support",
    "charges",
    "settings",
  ],
  staff: [
    "dashboard",
    "transactions",
    "masters",
    "users",
    "wallet",
    "reconciliation",
    "qr_codes",
    "settlements",
    "fund_requests",
    "ledger",
    "reports",
    "callbacks",
    "support",
    "charges",
    "settings",
  ],
  master: [
    "dashboard",
    "transactions",
    "merchants",
    "wallet",
    "ledger",
    "qr_codes",
    "fund_requests",
    "settlements",
    "reconciliation",
    "reports",
    "callbacks",
    "support",
    "charges",
    "settings",
  ],
  merchant: [
    "dashboard",
    "transactions",
    "branches",
    "qr_codes",
    "settlements",
    "fund_requests",
    "reconciliation",
    "wallet",
    "ledger",
    "callbacks",
    "support",
    "charges",
    "settings",
    "reports",
  ],
  branch: [
    "dashboard",
    "transactions",
    "qr_codes",
    "wallet",
    "ledger",
    "support",
    "settings",
  ],
};

function buildPermissions(user: any) {
  const role = user?.roles?.[0]?.role;
  if (role === "admin") {
    return {
      canManageUsers: true,
      canManageFinances: true,
      canManageCommissions: true,
      canManageServices: true,
      canManageSettings: true,
      canManageSecurity: true,
      canViewReports: true,
    };
  }

  if (role === "staff") {
    return {
      canManageUsers: user?.staffPermission?.canManageUsers ?? false,
      canManageFinances: user?.staffPermission?.canManageFinances ?? false,
      canManageCommissions: user?.staffPermission?.canManageCommissions ?? false,
      canManageServices: user?.staffPermission?.canManageServices ?? false,
      canManageSettings: user?.staffPermission?.canManageSettings ?? false,
      canManageSecurity: user?.staffPermission?.canManageSecurity ?? false,
      canViewReports: user?.staffPermission?.canViewReports ?? false,
    };
  }

  return null;
}

async function fetchAllowedPages(userId: string, role: string | undefined) {
  if (role === "admin") return ALL_STAFF_PAGES;
  if (role !== "staff") return null;

  const pageAccessSetting = await prisma.appSetting.findUnique({
    where: { key: `staff_page_access_${userId}` },
    select: { value: true },
  });

  try {
    return pageAccessSetting?.value ? JSON.parse(pageAccessSetting.value) : [];
  } catch {
    return [];
  }
}

async function fetchEnabledFeatures(userId: string, role: string | undefined) {
  const roleKey = String(role || "").toLowerCase();
  const defaults = FEATURE_ACCESS_DEFAULTS[roleKey] || [];
  if (roleKey === "admin") return defaults;

  const setting = await prisma.appSetting.findUnique({
    where: { key: `feature_access_${userId}` },
    select: { value: true },
  });

  try {
    return setting?.value ? JSON.parse(setting.value) : defaults;
  } catch {
    return defaults;
  }
}

export const registerUser = async (req: Request, res: Response) => {
  const { email, password, fullName, role } = req.body;
  const existingUser = await prisma.user.findUnique({ where: { email } });
  
  if (existingUser) return res.status(400).json({ error: "Email already in use" });

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      profile: {
        create: {
          fullName: fullName || "",
          status: "active",
          kycStatus: "pending",
        },
      },
      roles: {
        create: {
          role: role || "retailer",
        },
      },
      wallet: {
        create: {
          balance: 0,
        },
      },
    },
    include: {
      profile: true,
      roles: true,
    },
  });

  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.profile?.fullName,
      role: user.roles[0]?.role,
    },
  });
};

export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: true, roles: true, wallet: true, staffPermission: true },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
  const allowedPages = await fetchAllowedPages(user.id, user.roles[0]?.role);
  const enabledFeatures = await fetchEnabledFeatures(user.id, user.roles[0]?.role);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.profile?.fullName,
      role: user.roles[0]?.role,
      walletBalance: user.wallet ? Number(user.wallet.balance) : 0,
      permissions: buildPermissions(user),
      allowedPages,
      enabledFeatures,
    },
  });
};

export const getMe = async (req: any, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    include: { profile: true, roles: true, wallet: true, staffPermission: true },
  });

  if (!user) return res.status(404).json({ error: "User not found" });
  const allowedPages = await fetchAllowedPages(user.id, user.roles[0]?.role);
  const enabledFeatures = await fetchEnabledFeatures(user.id, user.roles[0]?.role);

  res.json({
    userId: user.id,
    email: user.email,
    profile: user.profile,
    role: user.roles[0]?.role,
    walletBalance: user.wallet ? Number(user.wallet.balance) : 0,
    eWalletBalance: user.wallet ? Number(user.wallet.eWalletBalance) : 0,
    permissions: buildPermissions(user),
    allowedPages,
    enabledFeatures,
  });
};

export const loginAsUser = async (req: any, res: Response) => {
  const callerId = req.userId!;
  const callerProfile = await prisma.profile.findUnique({ where: { userId: callerId } });
  const myRoleRow = await prisma.userRole.findFirst({ where: { userId: callerId } });
  const myRole = myRoleRow?.role;
  
  const isStaff = myRole === "staff";
  const canManageUsers = isStaff && req.permissions?.canManageUsers;
  
  if (myRole !== "admin" && myRole !== "merchant" && myRole !== "master" && !canManageUsers) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { id } = req.params; // Can be Profile ID or User ID
  const targetProfile = await prisma.profile.findFirst({ 
    where: {
      OR: [
        { id: id },
        { userId: id }
      ]
    },
    include: { user: { include: { roles: true, wallet: true, staffPermission: true } } }
  });

  if (!targetProfile || !targetProfile.user) return res.status(404).json({ error: "User not found" });

  // Security Check: merchant & master can only impersonate their own direct downline
  // Staff with canManageUsers is treated like an admin and has no parent-based restriction here.
  if ((myRole === "merchant" || myRole === "master") && !canManageUsers) {
    if (targetProfile.parentId !== callerProfile?.id) {
        return res.status(403).json({ error: "You can only impersonate your own direct downline" });
    }
  }

  const token = jwt.sign({ sub: targetProfile.user.id, email: targetProfile.user.email }, JWT_SECRET, { expiresIn: "7d" });
  const enabledFeatures = await fetchEnabledFeatures(targetProfile.user.id, targetProfile.user.roles[0]?.role);

  res.json({
    token,
    user: {
      id: targetProfile.user.id,
      email: targetProfile.user.email,
      fullName: targetProfile.fullName,
      role: targetProfile.user.roles[0]?.role,
      walletBalance: targetProfile.user.wallet ? Number(targetProfile.user.wallet.balance) : 0,
      permissions: null,
      allowedPages: null,
      enabledFeatures,
    },
  });
};
