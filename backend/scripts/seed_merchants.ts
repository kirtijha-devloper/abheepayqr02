import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);
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

  console.log('Seeding mock merchants...');

  for (const m of merchants) {
    try {
      // Check if user already exists
      const existing = await prisma.user.findUnique({ where: { email: m.email } });
      if (existing) {
        console.log(`Merchant ${m.email} already exists, skipping.`);
        continue;
      }

      const user = await prisma.user.create({
        data: {
          email: m.email,
          passwordHash,
          roles: {
            create: { role: 'retailer' }
          },
          profile: {
            create: {
              fullName: m.name,
              businessName: m.business,
              status: 'active'
            }
          },
          wallet: {
            create: { balance: 0 }
          }
        }
      });
      console.log(`Created merchant: ${m.name} (${user.id})`);
    } catch (err) {
      console.error(`Failed to create merchant ${m.name}:`, err);
    }
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
