import { decodeWithAI } from "./src/utils/aiDecoder";

async function test() {
    console.log("Testing decodeWithAI...");
    const result = await decodeWithAI("uploads/qrcodes/1774260145365-890837100.jpeg");
    console.log("Result:", result);
}

test().catch(console.error);
