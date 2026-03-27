
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const txnId = '787c4559-cea3-4485-'; // Partial match or from previous dump
  const txns = await prisma.transaction.findMany({
      where: { serviceType: 'payout' },
      include: { user: { include: { profile: true } } }
  });
  console.log(JSON.stringify(txns, null, 2));

  const allUsers = await prisma.user.findMany({
      include: { profile: true }
  });
  console.log('--- All Users & Profiles ---');
  console.log(JSON.stringify(allUsers, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
