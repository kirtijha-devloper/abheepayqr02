import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const pCount = await prisma.profile.count();
  const qCount = await prisma.qrCode.count();
  console.log(`COUNTS:PROFILES:${pCount}:QRCODES:${qCount}`);
  await prisma.$disconnect();
}
main();
