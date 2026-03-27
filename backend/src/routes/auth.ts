import { Router } from "express";
import { prisma } from "../index";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { email, password, fullName, role } = req.body;
  try {
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
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
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
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/me — get own profile + role
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
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
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/login-as/:id — Admin login-as feature
router.post("/login-as/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerId = req.userId!;
    const myRole = await prisma.userRole.findFirst({ where: { userId: callerId } });
    if (myRole?.role !== "admin") return res.status(403).json({ error: "Admin only" });

    const { id } = req.params; // This is the PROFILE id in the merchants table
    const targetProfile = await prisma.profile.findUnique({ 
      where: { id },
      include: { user: { include: { roles: true, wallet: true } } }
    });

    if (!targetProfile || !targetProfile.user) return res.status(404).json({ error: "Merchant not found" });

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
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
