import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSlab() {
  try {
    console.log("Testing slab creation...");
    const slab = await prisma.commissionSlab.create({
      data: {
        role: 'merchant',
        serviceKey: 'payout',
        serviceLabel: 'Payout',
        minAmount: 0,
        maxAmount: 999999,
        chargeType: 'flat',
        chargeValue: 10,
        commissionType: 'percent',
        commissionValue: 0
      }
    });
    console.log("Slab created successfully:", slab);
  } catch (e) {
    console.error("Error creating slab:", e);
  } finally {
    await prisma.$disconnect();
  }
}

testSlab();
