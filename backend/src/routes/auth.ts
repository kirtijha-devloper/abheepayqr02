import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { asyncHandler, asyncAuthHandler } from "../utils/asyncHandler";
import { registerUser, loginUser, getMe, loginAsUser } from "../controllers/authController";

const router = Router();

// POST /api/auth/register
router.post("/register", asyncHandler(registerUser));

// POST /api/auth/login
router.post("/login", asyncHandler(loginUser));

// GET /api/auth/me — get own profile + role 
router.get("/me", requireAuth, asyncAuthHandler(getMe));

// POST /api/auth/change-password — update own password
router.post("/change-password", requireAuth, async (req: AuthRequest, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "Current password and new password are required" });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters long" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const matches = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!matches) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/tpin - create or reset transaction pin
router.post("/tpin", requireAuth, async (req: AuthRequest, res) => {
  const { password, tpin } = req.body;

  if (!password) {
    return res.status(400).json({ error: "Account password is required" });
  }

  const normalizedTpin = String(tpin || "").trim();
  if (!/^\d{4}$/.test(normalizedTpin)) {
    return res.status(400).json({ error: "Transaction PIN must be exactly 4 digits" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const matches = await bcrypt.compare(String(password), user.passwordHash);
    if (!matches) {
      return res.status(400).json({ error: "Account password is incorrect" });
    }

    const tpinHash = await bcrypt.hash(normalizedTpin, 10);
    await prisma.profile.update({
      where: { userId: req.userId! },
      data: { tpinHash },
    });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/login-as/:id — Admin login-as feature
router.post("/login-as/:id", requireAuth, asyncAuthHandler(loginAsUser));

export default router;
