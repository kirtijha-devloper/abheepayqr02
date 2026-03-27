import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const txns = await prisma.transaction.findMany({
    where: { provider: 'Bank Report' },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { userId: true, amount: true, refId: true, provider: true, description: true }
  });
  console.log(JSON.stringify(txns, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
