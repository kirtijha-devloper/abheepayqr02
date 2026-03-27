import { Jimp } from "jimp";
import { MultiFormatReader, BinaryBitmap, HybridBinarizer, RGBLuminanceSource } from "@zxing/library";

async function testZxing() {
    const imagePath = "uploads/qrcodes/1774260145365-890837100.jpeg";
    console.log("Reading image with Jimp...");
    const image = await Jimp.read(imagePath);
    
    // Scale down if too large to improve speed and sometimes detection
    if (image.bitmap.width > 1200) {
        image.resize({ w: 1200 });
    }

    const value = image.bitmap.data;
    const width = image.bitmap.width;
    const height = image.bitmap.height;

    // Convert Jimp image data to RGBLuminanceSource
    const luminanceSource = new RGBLuminanceSource(
        new Uint8ClampedArray(value),
        width,
        height
    );

    const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
    const reader = new MultiFormatReader();

    try {
        const result = reader.decode(binaryBitmap);
        console.log("✅ ZXing Success:", result.getText());
    } catch (e) {
        console.error("❌ ZXing Failed:", e.message);
    }
}

testZxing().catch(console.error);
