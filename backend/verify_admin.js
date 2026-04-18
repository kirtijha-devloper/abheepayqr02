const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdmin() {
  const adminRole = await prisma.userRole.findFirst({
    where: { role: 'admin' },
    include: {
      user: true
    }
  });
  
  if (adminRole && adminRole.user) {
    console.log("Admin Email in DB:", adminRole.user.email);
  } else {
    console.log("No admin found in DB.");
  }
}

checkAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
