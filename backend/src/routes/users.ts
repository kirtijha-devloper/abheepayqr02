import { Router } from "express";
import { prisma } from "../index";
import { requireAuth, AuthRequest } from "../middleware/auth";
import bcrypt from "bcryptjs";

const router = Router();

// GET /api/users — get my downline users
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerId = req.userId!;
    console.log(`[GET /api/users] callerId: ${callerId}`);
    
    const myProfile = await prisma.profile.findUnique({ where: { userId: callerId } });
    if (!myProfile) {
      console.log(`[GET /api/users] Profile not found for callerId: ${callerId}`);
      return res.status(404).json({ error: "Profile not found" });
    }

    const myRole = await prisma.userRole.findFirst({ where: { userId: callerId } });
    console.log(`[GET /api/users] callerRole: ${myRole?.role}`);

    // Admin sees all
    const whereClause = myRole?.role === "admin" ? {} : { parentId: myProfile.id };
    console.log(`[GET /api/users] whereClause: ${JSON.stringify(whereClause)}`);

    const profiles = await prisma.profile.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            email: true,
            roles: { select: { role: true } },
            wallet: { select: { balance: true } },
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`[GET /api/users] Profiles found: ${profiles.length}`);

    const result = profiles.map(p => ({
      id: p.id,
      userId: p.userId,       // <-- actual User ID for wallet/QR operations
      fullName: p.fullName,
      businessName: p.businessName,
      status: p.status,
      email: p.user?.email,
      role: p.user?.roles[0]?.role,
      walletBalance: Number(p.user?.wallet?.balance ?? 0),
    }));

    res.json(result);
  } catch (e: any) {
    console.error(`[GET /api/users] Error: ${e.message}`, e);
    res.status(500).json({ error: e.message });
  }
});

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
  const { email, password, full_name, role, parent_id, ...extra } = req.body;
  try {
    const callerId = req.userId!;
    const callerRole = await prisma.userRole.findFirst({ where: { userId: callerId } });
    if (!callerRole) return res.status(403).json({ error: "Forbidden" });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: "Email already exists" });

    const passwordHash = await bcrypt.hash(password || "Password123!", 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          profile: {
            create: {
              fullName: full_name,
              phone: extra.phone,
              businessName: extra.business_name,
              parentId: parent_id,
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

// DELETE /api/users/:id — Delete user
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const callerId = req.userId!;
    const myRole = await prisma.userRole.findFirst({ where: { userId: callerId } });
    if (myRole?.role !== "admin") return res.status(403).json({ error: "Forbidden" });

    // Find the profile to get the userId
    const profile = await prisma.profile.findUnique({ where: { id } });
    if (!profile) return res.status(404).json({ error: "Profile not found" });

    await prisma.user.delete({ where: { id: profile.userId } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
