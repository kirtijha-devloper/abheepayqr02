import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const qrs = await prisma.qrCode.findMany();
  console.log('QR CODE STATUSES:');
  qrs.forEach(q => {
    console.log(`ID: ${q.id}, Status: "${q.status}", MerchantId: ${q.merchantId}`);
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
