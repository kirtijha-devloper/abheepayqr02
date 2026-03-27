import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  try {
    console.log("Connecting to database...");
    const result = await prisma.$queryRaw`SELECT 1`;
    console.log("Prisma SELECT 1 test:", result);
    
    const profiles = await prisma.profile.findMany();
    console.log(`Found ${profiles.length} profiles in database.`);
    
    const qrCount = await prisma.qrCode.count();
    console.log(`Found ${qrCount} QR codes in database.`);
  } catch (err) {
    console.error("Connection failed!", err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
