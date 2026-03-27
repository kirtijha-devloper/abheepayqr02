import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  try {
    const users = await prisma.user.findMany({
      include: {
        roles: true,
        profile: true,
      },
    });
    console.log('--- USERS AND PROFILES ---');
    users.forEach((u) => {
      console.log(`User: ${u.email}`);
      console.log(`  Role: ${u.roles.map((r) => r.role).join(', ')}`);
      console.log(`  Profile Name: ${u.profile?.fullName}`);
      console.log(`  Profile ID: ${u.profile?.id}`);
      console.log(`  Parent ID: ${u.profile?.parentId}`);
      console.log('--------------------------');
    });

    const merchants = await prisma.profile.findMany({
      include: {
        user: {
          select: {
            email: true,
            roles: { select: { role: true } },
          },
        },
      },
    });
    console.log(`Total Profiles in DB: ${merchants.length}`);
  } catch (err) {
    console.error('DATABASE_CHECK_FAILED:');
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
