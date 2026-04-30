import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding mock users...");

  // Find Admin
  const adminRole = await prisma.userRole.findFirst({
    where: { role: "admin" },
    include: { user: { include: { profile: true } } }
  });

  if (!adminRole) {
    console.log("No admin found. Please create an admin first.");
    process.exit(1);
  }

  const admin = adminRole.user;
  const adminProfileId = admin.profile?.id;

  if (!adminProfileId) {
    console.log("Admin has no profile ID!");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash("password123", 10);

  // 1. Create 5 Masters
  for (let i = 1; i <= 5; i++) {
    const masterEmail = `master${i}@test.com`;
    let master: any = await prisma.user.findUnique({ where: { email: masterEmail }, include: { profile: true } });
    
    if (!master) {
      master = await prisma.user.create({
        data: {
          email: masterEmail,
          passwordHash: passwordHash,
          roles: {
            create: { role: "master" }
          },
          profile: {
            create: {
              fullName: `Master User ${i}`,
              businessName: `Master Biz ${i}`,
              phone: `900000000${i}`,
              parentId: adminProfileId
            }
          },
          wallet: {
            create: { balance: 10000 }
          }
        },
        include: { profile: true }
      });
      console.log(`Created Master: ${master.email}`);
    } else {
        master = await prisma.user.findUnique({ where: { id: master.id }, include: { profile: true } });
        console.log(`Master already exists: ${master?.email}`);
    }

    const masterProfileId = master!.profile?.id;

    // 2. Create 5 Merchants under this Master
    for (let j = 1; j <= 5; j++) {
      const merchantEmail = `merchant${i}_${j}@test.com`;
      let merchant: any = await prisma.user.findUnique({ where: { email: merchantEmail }, include: { profile: true } });

      if (!merchant) {
        merchant = await prisma.user.create({
          data: {
            email: merchantEmail,
            passwordHash: passwordHash,
            roles: {
              create: { role: "merchant" }
            },
            profile: {
              create: {
                fullName: `Merchant ${i}-${j}`,
                businessName: `Merchant Biz ${i}-${j}`,
                phone: `8000000${i}${j}`,
                parentId: masterProfileId
              }
            },
            wallet: {
              create: { balance: 5000 }
            }
          },
          include: { profile: true }
        });
        console.log(`  Created Merchant: ${merchant.email}`);
      } else {
        merchant = await prisma.user.findUnique({ where: { id: merchant.id }, include: { profile: true } });
        console.log(`  Merchant already exists: ${merchant?.email}`);
      }

      const merchantProfileId = merchant!.profile?.id;

      // 3. Create 5 Branches under this Merchant
      for (let k = 1; k <= 5; k++) {
        const branchEmail = `branch${i}_${j}_${k}@test.com`;
        let branch: any = await prisma.user.findUnique({ where: { email: branchEmail }, include: { profile: true } });

        if (!branch) {
          branch = await prisma.user.create({
            data: {
              email: branchEmail,
              passwordHash: passwordHash,
              roles: {
                create: { role: "branch" }
              },
              profile: {
                create: {
                  fullName: `Branch ${i}-${j}-${k}`,
                  businessName: `Branch Biz ${i}-${j}-${k}`,
                  phone: `700000${i}${j}${k}`,
                  parentId: merchantProfileId
                }
              },
              wallet: {
                create: { balance: 1000 }
              }
            }
          });
          console.log(`    Created Branch: ${branch.email}`);
        }
      }
    }
  }

  console.log("Mock data seeding complete!");
  process.exit(0);
}

main().catch(console.error);
