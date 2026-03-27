import { Router } from "express";
import { prisma } from "../index";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/notifications — get my notifications
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const notifs = await prisma.notification.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    res.json(notifs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/notifications/:id/read — mark notification as read
router.patch("/:id/read", requireAuth, async (req: AuthRequest, res) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.userId! },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/notifications/read-all — mark all as read
router.patch("/read-all", requireAuth, async (req: AuthRequest, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.userId!, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/notifications — create a notification (internal use)
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { user_id, title, message, type, link } = req.body;
  try {
    const notif = await prisma.notification.create({
      data: { userId: user_id || req.userId!, title, message, type: type || "info", link },
    });
    res.json(notif);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
