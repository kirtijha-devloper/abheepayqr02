import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const qrs = await prisma.qrCode.findMany({
    where: { merchantId: { not: null } },
    select: { tid: true, merchantId: true, upiId: true, mid: true },
    take: 20
  });
  console.log(JSON.stringify(qrs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
