import { Router } from "express";
import { prisma } from "../index";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/support/tickets — get tickets (admin sees all, others see their own)
router.get("/tickets", requireAuth, async (req: AuthRequest, res) => {
  try {
    const roleRow = await prisma.userRole.findFirst({ where: { userId: req.userId! } });
    const isAdmin = roleRow?.role === "admin";

    const where = isAdmin ? {} : { userId: req.userId! };
    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            profile: {
              select: {
                fullName: true,
                businessName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(tickets);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/support/tickets — create a new ticket
router.post("/tickets", requireAuth, async (req: AuthRequest, res) => {
  const { subject, message, category } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ error: "Missing subject or message" });
  }
  try {
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: req.userId!,
        subject,
        message,
        category: category || "general",
        status: "open",
      },
    });

    // Notify admins
    const admins = await prisma.userRole.findMany({ where: { role: "admin" } });
    for (const a of admins) {
      await prisma.notification.create({
        data: {
          userId: a.userId,
          title: "New Support Ticket",
          message: `A new ticket "${subject}" was submitted.`,
          type: "info",
        },
      });
    }

    res.json(ticket);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/support/tickets/:id/reply — reply to a ticket (admin only)
router.patch("/tickets/:id/reply", requireAuth, async (req: AuthRequest, res) => {
  const { reply_text, status } = req.body;
  try {
    const roleRow = await prisma.userRole.findFirst({ where: { userId: req.userId! } });
    if (roleRow?.role !== "admin") return res.status(403).json({ error: "Forbidden" });

    const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    const updated = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: {
        adminReply: reply_text,
        repliedBy: req.userId!,
        repliedAt: new Date(),
        status: status || ticket.status,
      },
    });

    // Notify user
    await prisma.notification.create({
      data: {
        userId: ticket.userId,
        title: "Support Reply Received",
        message: `An admin has replied to your ticket: "${ticket.subject}".`,
        type: "info",
      },
    });

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
