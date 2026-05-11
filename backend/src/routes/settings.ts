import crypto from "crypto";
import express, { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest, requireAuth, requirePermission } from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();
const API_KEY_ENVIRONMENTS = ["sandbox", "production"] as const;

const buildApiKeySettingKey = (userId: string, environment: (typeof API_KEY_ENVIRONMENTS)[number]) =>
  `api_key:${userId}:${environment}`;

const createApiKey = (environment: (typeof API_KEY_ENVIRONMENTS)[number]) => {
  const prefix = environment === "production" ? "tl_live_" : "tl_test_";
  return `${prefix}${crypto.randomBytes(24).toString("hex")}`;
};

async function loadApiKeys(userId: string) {
  const settings = await prisma.appSetting.findMany({
    where: {
      key: {
        in: API_KEY_ENVIRONMENTS.map((environment) => buildApiKeySettingKey(userId, environment)),
      },
    },
  });

  return settings.reduce(
    (acc, setting) => {
      const environment = setting.key.split(":").pop();
      if (environment === "sandbox" || environment === "production") {
        acc[environment] = setting.value;
      }
      return acc;
    },
    { sandbox: "", production: "" } as Record<(typeof API_KEY_ENVIRONMENTS)[number], string>
  );
}

// GET /api/settings
// Fetch all global settings (or specific one by key query, though usually we just dump them)
router.get("/", requireAuth, async (_req: AuthRequest, res: Response) => {
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

router.get("/api-keys", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const apiKeys = await loadApiKeys(req.userId);
    res.json({ apiKeys });
  } catch (err: any) {
    console.error("Fetch API keys Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/api-keys/generate", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const requestedEnvironment =
      typeof req.body?.environment === "string" ? req.body.environment.trim().toLowerCase() : "all";
    const environments =
      requestedEnvironment === "sandbox" || requestedEnvironment === "production"
        ? [requestedEnvironment]
        : [...API_KEY_ENVIRONMENTS];

    await prisma.$transaction(
      environments.map((environment) => {
        const value = createApiKey(environment);
        return prisma.appSetting.upsert({
          where: { key: buildApiKeySettingKey(req.userId!, environment) },
          update: { value },
          create: {
            key: buildApiKeySettingKey(req.userId!, environment),
            value,
          },
        });
      })
    );

    const apiKeys = await loadApiKeys(req.userId);
    res.json({ success: true, apiKeys });
  } catch (err: any) {
    console.error("Generate API keys Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/settings
// Update settings (Admin only)
router.post("/", requireAuth, requirePermission("canManageSettings"), async (req: AuthRequest, res: Response) => {
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
