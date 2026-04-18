import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const profiles = await prisma.profile.findMany({
    include: {
      user: {
        include: {
          roles: true
        }
      }
    }
  });

  console.log(`Total profiles: ${profiles.length}`);
  profiles.forEach(p => {
    console.log(`Profile: ${p.fullName}, User: ${p.user?.email || 'N/A'}, Role: ${p.user?.roles?.[0]?.role || 'N/A'}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
