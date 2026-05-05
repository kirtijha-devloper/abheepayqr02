const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.qrCode.count();
  const qrs = await prisma.qrCode.findMany();
  const roles = await prisma.userRole.findMany();
  console.log(`TOTAL QR CODES IN DB: ${count}`);
  console.log('QR STATUSES:', qrs.map(q => q.status));
  console.log('ADMIN ROLES:', roles.filter(r => r.role === 'admin'));
}
main().catch(console.error).finally(() => prisma.$disconnect());
