import { Request, Response } from "express";
import { prisma } from "../index";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../utils/env";

const JWT_SECRET = getJwtSecret();

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
    include: { profile: true, roles: true, wallet: true },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.profile?.fullName,
      role: user.roles[0]?.role,
      walletBalance: user.wallet ? Number(user.wallet.balance) : 0,
    },
  });
};

export const getMe = async (req: any, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    include: { profile: true, roles: true, wallet: true },
  });

  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({
    userId: user.id,
    email: user.email,
    profile: user.profile,
    role: user.roles[0]?.role,
    walletBalance: user.wallet ? Number(user.wallet.balance) : 0,
    eWalletBalance: user.wallet ? Number(user.wallet.eWalletBalance) : 0,
  });
};

export const loginAsUser = async (req: any, res: Response) => {
  const callerId = req.userId!;
  const callerProfile = await prisma.profile.findUnique({ where: { userId: callerId } });
  const myRoleRow = await prisma.userRole.findFirst({ where: { userId: callerId } });
  const myRole = myRoleRow?.role;
  
  if (myRole !== "admin" && myRole !== "merchant" && myRole !== "master") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { id } = req.params; // Profile ID
  const targetProfile = await prisma.profile.findUnique({ 
    where: { id },
    include: { user: { include: { roles: true, wallet: true } } }
  });

  if (!targetProfile || !targetProfile.user) return res.status(404).json({ error: "User not found" });

  // Security Check: merchant & master can only impersonate their own direct downline
  if (myRole === "merchant" || myRole === "master") {
    if (targetProfile.parentId !== callerProfile?.id) {
        return res.status(403).json({ error: "You can only impersonate your own direct downline" });
    }
  }

  const token = jwt.sign({ sub: targetProfile.user.id, email: targetProfile.user.email }, JWT_SECRET, { expiresIn: "7d" });

  res.json({
    token,
    user: {
      id: targetProfile.user.id,
      email: targetProfile.user.email,
      fullName: targetProfile.fullName,
      role: targetProfile.user.roles[0]?.role,
      walletBalance: targetProfile.user.wallet ? Number(targetProfile.user.wallet.balance) : 0,
    },
  });
};
