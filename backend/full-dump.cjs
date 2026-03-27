
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- ALL Transactions ---');
  const txns = await prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  console.log(JSON.stringify(txns, null, 2));

  console.log('\n--- ALL Fund Requests ---');
  const fundReqs = await prisma.fundRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  console.log(JSON.stringify(fundReqs, null, 2));

  console.log('\n--- ALL User Roles ---');
  const roles = await prisma.userRole.findMany();
  console.log(JSON.stringify(roles, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
