import { PrismaClient } from "@prisma/client";
import { decodeWithAI } from "./src/utils/aiDecoder";

const prisma = new PrismaClient();

async function run() {
    console.log("Fetching placeholders...");
    const placeholders = await prisma.qrCode.findMany({
        where: {
            upiId: { contains: "MANUAL-UPI" },
            imagePath: { not: null }
        }
    });

    console.log(`Found ${placeholders.length} placeholders.`);
    let fixed = 0;
    
    for (const qr of placeholders) {
        if (!qr.imagePath) continue;
        console.log(`Testing ${qr.imagePath}...`);
        const result = await decodeWithAI(qr.imagePath);
        if (result.success && result.upiId) {
            fixed++;
        }
    }
    
    console.log(`Successfully decoded ${fixed} out of ${placeholders.length}`);
}

run()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
