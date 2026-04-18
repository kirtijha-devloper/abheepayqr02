import { Response } from "express";
import { prisma } from "../index";

export const getDownlineUsers = async (req: any, res: Response) => {
  const callerId = req.userId!;
  
  const myProfile = await prisma.profile.findUnique({ where: { userId: callerId } });
  if (!myProfile) {
    return res.status(404).json({ error: "Profile not found" });
  }

  const myRole = await prisma.userRole.findFirst({ where: { userId: callerId } });
  const isAdmin = myRole?.role === "admin";
  const parentIdQuery = req.query.parentId as string;

  let whereClause: any = {};

  if (isAdmin) {
    if (parentIdQuery) {
      whereClause = { parentId: parentIdQuery };
    } else {
      whereClause = {
        user: {
          roles: {
            some: { role: "merchant" }
          }
        }
      };
    }
  } else {
    // Merchants see their children
    whereClause = { parentId: myProfile.id };
  }

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

  console.log(`[getDownlineUsers] Returning ${result.length} users for caller ${callerId}`);
  res.json(result);
};
