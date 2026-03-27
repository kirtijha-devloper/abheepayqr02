import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixUPIs() {
    console.log("Fetching qr codes with upi:// URIs...");
    const qrs = await prisma.qrCode.findMany({
        where: {
            upiId: { startsWith: "upi://" }
        }
    });

    console.log(`Found ${qrs.length} QRs with full URIs.`);
    let fixed = 0;
    
    for (const qr of qrs) {
        const match = qr.upiId.match(/[?&]pa=([^&]+)/i);
        if (match && match[1]) {
            const cleanUpi = decodeURIComponent(match[1]);
            await prisma.qrCode.update({
                where: { id: qr.id },
                data: { upiId: cleanUpi }
            });
            console.log(`Fixed: ${qr.upiId} -> ${cleanUpi}`);
            fixed++;
        }
    }
    
    console.log(`Successfully fixed ${fixed} out of ${qrs.length}`);
}

fixUPIs()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
