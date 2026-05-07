import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/bank-accounts - list my bank accounts
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const accounts = await prisma.merchantBankAccount.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
    });
    res.json(accounts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bank-accounts - add a bank account
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { bankName, accountName, accountNumber, ifscCode } = req.body;
  try {
    const account = await prisma.merchantBankAccount.create({
      data: {
        userId: req.userId!,
        bankName,
        accountName,
        accountNumber,
        ifscCode,
      },
    });
    res.json(account);
  } catch (err: any) {
    console.error("[BankAccounts] Create failed:", err);
    res.status(500).json({ error: err.message || "Failed to create bank account" });
  }
});

// DELETE /api/bank-accounts/:id
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    await prisma.merchantBankAccount.delete({
      where: { id, userId: req.userId! },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
