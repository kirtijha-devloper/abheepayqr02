import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function addFunds() {
  console.log("Updating all wallets with 100,000 Main Balance...");
  try {
    const result = await prisma.wallet.updateMany({
      data: {
        balance: { increment: 100000 }
      }
    });
    console.log(`Successfully updated ${result.count} wallets.`);
  } catch (err) {
    console.error("Error updating wallets:", err);
  } finally {
    await prisma.$disconnect();
  }
}

addFunds();
