import { Router } from "express";
import { prisma } from "../index";
import { requireAuth, AuthRequest } from "../middleware/auth";
import bcrypt from "bcryptjs";
import { asyncAuthHandler } from "../utils/asyncHandler";
import { getDownlineUsers } from "../controllers/userController";
import { AppRole } from "@prisma/client";

const router = Router();

// GET /api/users/all — admin only: fetch all users across all levels
router.get("/all", requireAuth, async (req: AuthRequest, res) => {
  try {
    const canManage = req.userRole === "admin" || (req.userRole === "staff" && req.permissions?.canManageUsers);
    if (!canManage) return res.status(403).json({ error: "Access denied" });

    const users = await prisma.user.findMany({
      include: { profile: true, roles: true, wallet: true },
      orderBy: { createdAt: "desc" },
    });

    const allProfiles = await prisma.profile.findMany({
        select: { id: true, fullName: true, businessName: true }
    });
    const profileNameMap = new Map(allProfiles.map(p => [p.id, p.fullName || p.businessName || 'Unnamed']));

    const result = users.map(u => ({
      id: u.id,
      userId: u.id,
      profileId: u.profile?.id,
      email: u.email,
      role: u.roles[0]?.role,
      fullName: u.profile?.fullName,
      businessName: u.profile?.businessName,
      phone: u.profile?.phone,
      status: u.profile?.status,
      kycStatus: u.profile?.kycStatus,
      walletBalance: Number(u.wallet?.balance ?? 0),
      createdAt: u.createdAt,
      parentId: u.profile?.parentId,
      parentName: u.profile?.parentId ? profileNameMap.get(u.profile.parentId) : "Direct Admin",
    }));

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

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
      let targetRole: AppRole = "branch";
      let targetParentId: string | null = null;
      
      const requestedParentId = extra.parentId;
      
      if (requestedParentId) {
          // Find requested parent
          const parentProfile = await tx.profile.findUnique({ where: { id: requestedParentId }, include: { user: { include: { roles: true } } } });
          if (!parentProfile) throw new Error("Requested parent profile not found");
          
          const parentRole = parentProfile.user.roles[0]?.role;
          if (parentRole === "admin") targetRole = "master";
          else if (parentRole === "master") targetRole = "merchant";
          else if (parentRole === "merchant") targetRole = "branch";
          else throw new Error("Cannot add downline to this parent role");
          
          targetParentId = requestedParentId;
      } else {
          if (callerRole === "admin") {
            targetRole = "master";
            targetParentId = callerProfileId || null;
          } else if (callerRole === "master") {
            targetRole = "merchant";
            targetParentId = callerProfileId || null;
          } else if (callerRole === "merchant") {
            targetRole = "branch";
            targetParentId = callerProfileId || null;
          } else {
            throw new Error("Unauthorized to create users");
          }
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
    if (myRole?.role !== "admin" && myRole?.role !== "master") return res.status(403).json({ error: "Forbidden" });

    // master can only edit their own downline merchants
    if (myRole?.role === "master") {
      const targetProfile = await prisma.profile.findUnique({ where: { id } });
      const myProfile = await prisma.profile.findUnique({ where: { userId: callerId } });
      if (targetProfile?.parentId !== myProfile?.id) return res.status(403).json({ error: "Forbidden: not your downline" });
    }

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
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params; // This is the profile ID based on frontend calls
  try {
    const callerId = req.userId!;
    const myRole = await prisma.userRole.findFirst({ where: { userId: callerId } });
    
    // 1. Get the target profile and user
    const targetProfile = await prisma.profile.findUnique({ where: { id } });
    if (!targetProfile) return res.status(404).json({ error: "User profile not found" });
    
    const targetUserId = targetProfile.userId;

    // 2. Permission check
    if (myRole?.role !== "admin") {
      const myProfile = await prisma.profile.findUnique({ where: { userId: callerId } });
      if (targetProfile.parentId !== myProfile?.id) {
        return res.status(403).json({ error: "Forbidden: You can only delete your direct downline." });
      }
    }

    // 3. Check for downlines (children)
    const childrenCount = await prisma.profile.count({ where: { parentId: id } });
    if (childrenCount > 0) {
      return res.status(400).json({ error: "Cannot delete user who has downline members. Reassign or delete them first." });
    }

    // 4. Delete the user
    // Profile, Wallet, and UserRole will cascade delete because of 'onDelete: Cascade' in schema.
    // QrCodes, Transactions, and FundRequests do NOT cascade.
    await prisma.$transaction(async (tx) => {
        // Delete minor dependencies
        await tx.notification.deleteMany({ where: { userId: targetUserId } });
        await tx.userCommissionOverride.deleteMany({ where: { targetUserId: targetUserId } });
        await tx.userServiceOverride.deleteMany({ where: { targetUserId: targetUserId } });
        await tx.qrCode.deleteMany({ where: { merchantId: targetUserId } });
        
        // Try to delete the user
        await tx.user.delete({ where: { id: targetUserId } });
    });

    res.json({ success: true });
  } catch (e: any) {
    console.error(`[DELETE /api/users/:id] Error: ${e.message}`);
    // Handle foreign key constraint errors (P2003)
    if (e.code === 'P2003') {
        return res.status(400).json({ 
            error: "Cannot delete user with existing transactions or fund requests. Please suspend them instead." 
        });
    }
    res.status(500).json({ error: e.message });
  }
});

export default router;
