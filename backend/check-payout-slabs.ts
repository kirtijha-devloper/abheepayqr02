import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const slabs = await prisma.commissionSlab.findMany({
    where: {
      role: "admin",
      serviceKey: "payout",
    }
  });
  console.log("Admin Payout Slabs:", JSON.stringify(slabs, null, 2));

  const globals = await prisma.commissionSlab.findMany({
    where: {
      serviceKey: "payout"
    }
  });
  console.log("All Payout Slabs:", JSON.stringify(globals, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
