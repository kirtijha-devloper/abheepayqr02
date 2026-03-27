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
    
    // Test just one!
    const qr = placeholders[0];
    if (qr.imagePath) {
        console.log(`Testing ${qr.imagePath}...`);
        const result = await decodeWithAI(qr.imagePath);
        console.log("API Result:", result);
    }
}

run()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
