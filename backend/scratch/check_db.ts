import { prisma } from "../src/prisma";

async function main() {
  try {
    const result = await prisma.$queryRaw`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public';`;
    console.log("Tables in public schema:", result);
  } catch (err) {
    console.error("Error checking tables:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
