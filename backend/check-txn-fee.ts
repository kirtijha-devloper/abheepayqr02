import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const txn = await (prisma as any).transaction.findFirst({
    where: {
      OR: [
        { id: { contains: "40a92eb3" } },
        { description: { contains: "40a92eb3" } }
      ]
    }
  });

  if (!txn) {
    console.log("Transaction not found");
    return;
  }

  console.log("Found Transaction:", JSON.stringify(txn, null, 2));

  const walletTxn = await prisma.walletTransaction.findFirst({
    where: { 
        OR: [
            { id: { contains: "40a92eb3" } },
            { description: { contains: txn.id.substring(0,8) } }
        ]
    }
  });
  console.log("Associated Wallet Transaction:", JSON.stringify(walletTxn, null, 2));

  // Check the user role for this transaction
  const userRole = await prisma.userRole.findFirst({
    where: { userId: txn.userId }
  });
  console.log("User Role for this transaction:", userRole?.role);
}

main().catch(console.error).finally(() => prisma.$disconnect());
