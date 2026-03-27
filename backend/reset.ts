import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@telering.com";
  const newPassword = "admin123";
  const passwordHash = await bcrypt.hash(newPassword, 10);

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  
  if (!existingAdmin) {
    console.log("Admin does not exist! Run seed.ts first.");
    return;
  }

  await prisma.user.update({
    where: { email: adminEmail },
    data: { passwordHash }
  });

  console.log(`✅ Reset password for ${adminEmail} to ${newPassword}`);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
