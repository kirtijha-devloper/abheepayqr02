import { Response } from "express";
import { prisma } from "../index";

export const getDownlineUsers = async (req: any, res: Response) => {
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
          userCommissionOverrides: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`[GET /api/users] Profiles found: ${profiles.length}`);

  const result = profiles.map((p: any) => ({
    id: p.id,
    userId: p.userId,       // <-- actual User ID for wallet/QR operations
    fullName: p.fullName,
    businessName: p.businessName,
    status: p.status,
    email: p.user?.email,
    role: p.user?.roles?.[0]?.role,
    walletBalance: Number(p.user?.wallet?.balance ?? 0),
    payoutOverride: p.user?.userCommissionOverrides?.find((ov: any) => ov.serviceKey === 'payout'),
  }));

  res.json(result);
};
