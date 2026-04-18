const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkPassword() {
  const adminRole = await prisma.userRole.findFirst({
    where: { role: 'admin' },
    include: {
      user: true
    }
  });

  if (adminRole && adminRole.user) {
    const isMatch = await bcrypt.compare('admin123', adminRole.user.passwordHash);
    console.log("Password matches 'admin123':", isMatch);
  } else {
    console.log("No admin found in DB.");
  }
}

checkPassword()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
