import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const transactions = await prisma.transaction.findMany({
    where: {
      serviceType: "payout",
      amount: 500,
      fee: 10
    },
    include: {
      user: {
        include: {
          roles: true,
          profile: true
        }
      }
    }
  });

  console.log("Matching Transactions:", JSON.stringify(transactions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
