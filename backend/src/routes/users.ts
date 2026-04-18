import { Router } from "express";
import { prisma } from "../index";
import { requireAuth, AuthRequest } from "../middleware/auth";
import bcrypt from "bcryptjs";
import { asyncAuthHandler } from "../utils/asyncHandler";
import { getDownlineUsers } from "../controllers/userController";

const router = Router();

// GET /api/users — get my downline users
// DECOUPLED: Logic moved to backend/src/controllers/userController.ts
router.get("/", requireAuth, asyncAuthHandler(getDownlineUsers));

// GET /api/users/profile — get my own profile
router.get("/profile", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: { profile: true, roles: true, wallet: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      ...user.profile,
      email: user.email,
      role: user.roles[0]?.role,
      walletBalance: Number(user.wallet?.balance ?? 0),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/users/profile — update own profile
router.patch("/profile", requireAuth, async (req: AuthRequest, res) => {
  const { fullName, phone, businessName, callbackUrl } = req.body;
  try {
    const profile = await prisma.profile.update({
      where: { userId: req.userId! },
      data: { fullName, phone, businessName, callbackUrl },
    });
    res.json(profile);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/users — creation of a new user
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { email, password, full_name, ...extra } = req.body;
  
  if (!password || String(password).length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
  }

  try {
    const callerId = req.userId!;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: "Email already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      // Find caller's profile and role
      const caller = await tx.user.findUnique({
        where: { id: callerId },
        include: { profile: true, roles: true }
      });

      if (!caller || !caller.roles.length) throw new Error("Caller not found or has no roles");
      const callerRole = caller.roles[0].role;
      const callerProfileId = caller.profile?.id;

      // Determine new user's role and parent
      let targetRole: AppRole = "retailer";
      let targetParentId: string | null = null;

      if (callerRole === "admin") {
        targetRole = "merchant";
        targetParentId = callerProfileId || null;
      } else if (callerRole === "merchant") {
        targetRole = "branch";
        targetParentId = callerProfileId || null;
      } else {
        throw new Error("Unauthorized to create users");
      }

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          profile: {
            create: {
              fullName: full_name,
              phone: extra.phone,
              businessName: extra.business_name,
              parentId: targetParentId,
              status: "active",
              kycStatus: "pending",
            },
          },
          roles: {
            create: {
              role: targetRole,
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
        },
      });
      return user;
    });

    res.json({ success: true, user: { id: result.id, email: result.email }, profile: result.profile });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/users/:id/status — Toggle user status
router.patch("/:id/status", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const callerId = req.userId!;
    const myRole = await prisma.userRole.findFirst({ where: { userId: callerId } });
    if (myRole?.role !== "admin") {
      // Non-admins can only toggle their downline
      const profile = await prisma.profile.findUnique({ where: { id } });
      const myProfile = await prisma.profile.findUnique({ where: { userId: callerId } });
      if (profile?.parentId !== myProfile?.id) return res.status(403).json({ error: "Forbidden" });
    }

    const updated = await prisma.profile.update({
      where: { id },
      data: { status },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/users/:id — Admin updates specific merchant
router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { fullName, phone, businessName, callbackUrl, email, payoutChargeType, payoutChargeValue } = req.body;
  
  try {
    const callerId = req.userId!;
    const myRole = await prisma.userRole.findFirst({ where: { userId: callerId } });
    if (myRole?.role !== "admin") return res.status(403).json({ error: "Forbidden" });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Profile
      const profile = await tx.profile.update({
        where: { id },
        data: { fullName, phone, businessName, callbackUrl },
      });

      // 2. Update User email if provided
      if (email) {
        await tx.user.update({
          where: { id: profile.userId },
          data: { email },
        });
      }

      // 3. Update Payout Commission/Charge Override
      if (payoutChargeType && payoutChargeValue !== undefined) {
          await tx.userCommissionOverride.upsert({
              where: { 
                  targetUserId_serviceKey: { 
                      targetUserId: profile.userId, 
                      serviceKey: 'payout' 
                  } 
              },
              update: { 
                  chargeType: payoutChargeType, 
                  chargeValue: payoutChargeValue,
                  serviceLabel: 'Payout'
              },
              create: {
                  targetUserId: profile.userId,
                  serviceKey: 'payout',
                  serviceLabel: 'Payout',
                  chargeType: payoutChargeType,
                  chargeValue: payoutChargeValue,
                  setBy: callerId
              }
          });
      }

      return profile;
    });

    res.json({ success: true, profile: result });
  } catch (e: any) {
    console.error(`[PATCH /api/users/:id] Error: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/users/:id — Delete user

export default router;
