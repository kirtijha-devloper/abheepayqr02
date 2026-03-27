import jsqr from "jsqr";
import path from "path";
import fs from "fs";

// Using named require for Jimp v1.6.0+
const { Jimp } = require("jimp");

export async function decodeWithAI(imagePath: string): Promise<{ success: boolean; upiId?: string; error?: string }> {
    try {
        // Construct absolute path for the image
        let absoluteImagePath = imagePath;
        if (imagePath.startsWith("/uploads") || imagePath.startsWith("\\uploads")) {
            absoluteImagePath = path.join(__dirname, "../../", imagePath);
        } else if (!path.isAbsolute(imagePath)) {
            absoluteImagePath = path.join(__dirname, "../../", imagePath);
        }

        if (!fs.existsSync(absoluteImagePath)) {
            return { success: false, error: `Image not found: ${absoluteImagePath}` };
        }

        // Read image using Jimp
        const image = await Jimp.read(absoluteImagePath);
        const { data, width, height } = image.bitmap;

        // Decode QR using jsQR (pure JS)
        const code = jsqr(new Uint8ClampedArray(data), width, height, {
            inversionAttempts: "dontInvert",
        });

        if (code) {
            let finalUpiId = code.data.trim();
            if (finalUpiId.toLowerCase().startsWith("upi://")) {
                const match = finalUpiId.match(/[?&]pa=([^&]+)/i);
                if (match && match[1]) {
                    finalUpiId = decodeURIComponent(match[1]);
                }
            }
            console.log(`✅ Decoded QR for ${imagePath}: ${finalUpiId}`);
            return { success: true, upiId: finalUpiId };
        } else {
            // Try inverted
            const codeInverted = jsqr(new Uint8ClampedArray(data), width, height, {
                inversionAttempts: "attemptBoth",
            });
            
            if (codeInverted) {
                let finalUpiId = codeInverted.data.trim();
                if (finalUpiId.toLowerCase().startsWith("upi://")) {
                    const match = finalUpiId.match(/[?&]pa=([^&]+)/i);
                    if (match && match[1]) {
                        finalUpiId = decodeURIComponent(match[1]);
                    }
                }
                console.log(`✅ Decoded QR (Inverted) for ${imagePath}: ${finalUpiId}`);
                return { success: true, upiId: finalUpiId };
            }
            
            return { success: false, error: "No QR code detected" };
        }
    } catch (err: any) {
        console.error(`JS Decoder Error for ${imagePath}:`, err);
        return { success: false, error: err.message };
    }
}
