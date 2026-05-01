import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/bank-accounts — Get my bank accounts
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const accounts = await (prisma as any).merchantBankAccount.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" }
    });
    res.json(accounts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bank-accounts — Add a bank account
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { bankName, accountName, accountNumber, ifscCode } = req.body;
  try {
    const account = await (prisma as any).merchantBankAccount.create({
      data: {
        userId: req.userId!,
        bankName,
        accountName,
        accountNumber,
        ifscCode,
      }
    });
    res.json(account);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bank-accounts/:id — Delete a bank account
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    await (prisma as any).merchantBankAccount.delete({
      where: { id: req.params.id, userId: req.userId! }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
