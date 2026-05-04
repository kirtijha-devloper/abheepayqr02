import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminUser = await prisma.user.findFirst({
    where: { email: "admin@leopay.com" },
    include: { roles: true, profile: true }
  });

  if (!adminUser) {
    console.log("Admin not found");
    return;
  }

  const callerId = adminUser.id;
  const myProfile = adminUser.profile;
  const myRole = adminUser.roles[0]?.role;

  console.log(`Caller: ${adminUser.email}, Role: ${myRole}`);

  const whereClause = myRole === "admin" ? {} : { parentId: myProfile?.id };
  
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

  console.log(`API Found ${profiles.length} profiles.`);
  const result = profiles.map((p: any) => ({
    id: p.id,
    userId: p.userId,
    fullName: p.fullName,
    email: p.user?.email,
    role: p.user?.roles?.[0]?.role,
  }));

  console.log("First 3 results:", result.slice(0, 3));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
