import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
prisma.qrCode.findMany({ take: 5, orderBy: { createdAt: 'desc' } }).then(console.log).finally(() => prisma.$disconnect());
