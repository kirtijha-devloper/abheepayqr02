import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth, requirePermission } from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/settings
// Fetch all global settings (or specific one by key query, though usually we just dump them)
router.get("/", requireAuth, async (req: Request, res: Response) => {
    try {
        const settings = await prisma.appSetting.findMany();
        // Convert array of {key, value} into an object { key: value }
        const settingsMap = settings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {} as Record<string, string>);
        
        res.json(settingsMap);
    } catch (err: any) {
        console.error("Fetch Settings Error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// POST /api/settings
// Update settings (Admin only)
router.post("/", requireAuth, requirePermission("canManageSettings"), async (req: Request, res: Response) => {
    const updates: Record<string, string> = req.body; // e.g., { "payout_charge_type": "flat", "payout_charge_value": "10" }

    try {
        const operations = Object.entries(updates).map(([key, value]) => {
            return prisma.appSetting.upsert({
                where: { key },
                update: { value: String(value) },
                create: { key, value: String(value) },
            });
        });

        await prisma.$transaction(operations);

        const newSettings = await prisma.appSetting.findMany();
        const settingsMap = newSettings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {} as Record<string, string>);

        res.json({ success: true, settings: settingsMap });
    } catch (err: any) {
        console.error("Update Settings Error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

export default router;
