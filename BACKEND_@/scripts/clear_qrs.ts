import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function clearQrs() {
  console.log("Deleting all QR codes from the database...");
  const deleteQrs = await prisma.qrCode.deleteMany({});
  console.log(`Successfully deleted ${deleteQrs.count} QR codes.`);
}

clearQrs().catch(console.error).finally(() => prisma.$disconnect());
