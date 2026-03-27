
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Transactions (serviceType: payout) ---');
  const txns = await prisma.transaction.findMany({
    where: { serviceType: 'payout' },
    orderBy: { createdAt: 'desc' }
  });
  console.log(JSON.stringify(txns, null, 2));

  console.log('\n--- Fund Requests ---');
  const fundReqs = await prisma.fundRequest.findMany({
    orderBy: { createdAt: 'desc' }
  });
  console.log(JSON.stringify(fundReqs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
