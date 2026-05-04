import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@leopay.com";
  const adminPassword = "admin123";

  console.log("🌱 Seeding database...");

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existingAdmin) {
    console.log("ℹ️ Admin user already exists. Skipping.");
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      profile: {
        create: {
          fullName: "AbheePay Admin",
          status: "active",
          kycStatus: "verified",
        },
      },
      roles: {
        create: {
          role: "admin",
        },
      },
      wallet: {
        create: {
          balance: 100000, // Initial seed balance
        },
      },
    },
  });

  console.log(`✅ Admin user created: ${admin.email}`);

  // Seed some default service configs
  const services = [
    { serviceKey: "aeps", serviceLabel: "AePS", routePath: "/services/aeps" },
    { serviceKey: "dmt", serviceLabel: "Remittance", routePath: "/services/remittance" },
    { serviceKey: "bbps", serviceLabel: "BBPS", routePath: "/services/bbps" },
    { serviceKey: "payout", serviceLabel: "Payout", routePath: "/services/payout" },
    { serviceKey: "recharge", serviceLabel: "Recharge", routePath: "/services/recharge" },
  ];

  for (const s of services) {
    await prisma.serviceConfig.upsert({
      where: { serviceKey: s.serviceKey },
      update: {},
      create: s,
    });
  }
  
  console.log("✅ Default service configs seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
