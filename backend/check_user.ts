import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const userId = '0ec320ee-9bae-4d5b-bcf5-62df83f02887';
  const roles = await prisma.userRole.findMany({ where: { userId } });
  const profile = await prisma.profile.findUnique({ where: { userId } });
  console.log("Roles:", JSON.stringify(roles, null, 2));
  console.log("Profile:", JSON.stringify(profile, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
