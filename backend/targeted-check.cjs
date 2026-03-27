
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Searching for any pending requests...');
  
  // 1. Check FundRequest table
  const fundRequests = await prisma.fundRequest.findMany({
    where: { status: 'pending' },
    include: { bankAccount: true }
  });
  console.log(`Found ${fundRequests.length} pending FundRequests.`);
  for (const fr of fundRequests) {
    console.log(`FundRequest ID: ${fr.id}, Amount: ${fr.amount}, User: ${fr.requesterId}`);
  }

  // 2. Check Transaction table (payouts)
  const payouts = await prisma.transaction.findMany({
    where: { serviceType: 'payout', status: 'pending' }
  });
  console.log(`Found ${payouts.length} pending Payout Transactions.`);
  for (const p of payouts) {
    console.log(`Payout ID: ${p.id}, Amount: ${p.amount}, User: ${p.userId}`);
  }

  // 3. User info for verification
  const retailers = await prisma.userRole.findMany({
    where: { role: 'retailer' },
    include: { user: { include: { profile: true } } }
  });
  console.log('\n--- Retailers ---');
  for (const r of retailers) {
    console.log(`User: ${r.user.id}, Name: ${r.user.profile?.fullName}, Email: ${r.user.email}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
