import { PrismaClient } from "@prisma/client";
import { getEffectiveChargeConfig } from "./src/utils/commission";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({
    where: { roles: { some: { role: "admin" } } }
  });

  if (!admin) {
    console.log("Admin not found");
    return;
  }

  const config = await getEffectiveChargeConfig(prisma, {
    userId: admin.id,
    serviceKey: "payout",
    amount: 1000
  });

  console.log("Admin Payout Config:", JSON.stringify(config, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
