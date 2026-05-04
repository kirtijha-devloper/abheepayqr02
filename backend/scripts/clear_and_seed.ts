import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Clearing database...");

  // Keep the admin user intact
  const adminEmail = "admin@leopay.com";
  const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  
  const adminId = adminUser ? adminUser.id : 'THIS_WONT_MATCH';

  // Delete all related records first to avoid foreign key violations
  await prisma.transaction.deleteMany({ where: { NOT: { userId: adminId } } });
  await prisma.walletTransaction.deleteMany({ where: { NOT: { createdBy: adminId, toUserId: adminId, fromUserId: adminId } } });
  await prisma.commissionLog.deleteMany({ where: { NOT: { userId: adminId } } });
  await prisma.kycDocument.deleteMany({ where: { NOT: { userId: adminId } } });
  await prisma.notification.deleteMany({ where: { NOT: { userId: adminId } } });
  await prisma.supportTicket.deleteMany({ where: { NOT: { userId: adminId } } });
  await prisma.eWalletCredit.deleteMany({ where: { NOT: { userId: adminId } } });
  await prisma.qrCode.deleteMany({ where: { NOT: { merchantId: adminId } } });

  // Delete non-admin profiles, wallets, roles, and finally users
  await prisma.profile.deleteMany({ where: { NOT: { userId: adminId } } });
  await prisma.wallet.deleteMany({ where: { NOT: { userId: adminId } } });
  await prisma.userRole.deleteMany({ where: { NOT: { userId: adminId } } });
  
  const deletedUsers = await prisma.user.deleteMany({ where: { NOT: { id: adminId } } });
  console.log(`✅ Cleared ${deletedUsers.count} non-admin users and their data.`);

  console.log("🌱 Seeding 8 fresh mock merchants...");
  const passwordHash = await bcrypt.hash("password123", 10);
  
  const merchants = [
    { name: 'Aditya Kumar', email: 'aditya@example.com', business: 'Aditya Enterprises' },
    { name: 'Vikram Singh', email: 'vikram@example.com', business: 'Vikram Telecom' },
    { name: 'Neha Sharma', email: 'neha@example.com', business: 'Neha General Store' },
    { name: 'Rahul Verma', email: 'rahul@example.com', business: 'Rahul Pay' },
    { name: 'Sanjay Gupta', email: 'sanjay@example.com', business: 'Gupta Sweets' },
    { name: 'Anita Devi', email: 'anita@example.com', business: 'Anita Boutique' },
    { name: 'Mohit Raj', email: 'mohit@example.com', business: 'Mohit Mobile' },
    { name: 'Priya Kapoor', email: 'priya@example.com', business: 'Priya Cosmetics' },
  ];

  for (const m of merchants) {
    try {
      const user = await prisma.user.create({
        data: {
          email: m.email,
          passwordHash,
          roles: { create: { role: 'retailer' } },
          profile: {
            create: {
              fullName: m.name,
              businessName: m.business,
              status: 'active'
            }
          },
          wallet: { create: { balance: 0 } }
        }
      });
      console.log(`Created merchant: ${m.name} (${user.email})`);
    } catch (err) {
      console.error(`Failed to create merchant ${m.name}:`, err);
    }
  }

  console.log('✅ Database reset and seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
