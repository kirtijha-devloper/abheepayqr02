import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      profile: {
        fullName: { contains: "ADMIN" }
      }
    },
    include: {
      roles: true,
      profile: true
    }
  });

  if (!user) {
    console.log("Admin user not found");
    return;
  }

  console.log("Admin User Info:", JSON.stringify(user, null, 2));

  const overrides = await prisma.userCommissionOverride.findMany({
    where: { targetUserId: user.id, serviceKey: "payout" }
  });
  console.log("Admin Payout Overrides:", JSON.stringify(overrides, null, 2));

  const defaults = await prisma.downlineChargeDefault.findMany({
    where: { targetRole: "admin", serviceKey: "payout" }
  });
  console.log("Defaults for Admin Payout:", JSON.stringify(defaults, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
