import { Router } from "express";
import { Prisma } from "@prisma/client";
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

// PATCH /api/bank-accounts/:id - update my bank account
router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { bankName, accountName, accountNumber, ifscCode } = req.body;

  try {
    const existing = await prisma.merchantBankAccount.findFirst({
      where: { id, userId: req.userId! },
    });

    if (!existing) {
      return res.status(404).json({ error: "Bank account not found" });
    }

    const updated = await prisma.merchantBankAccount.update({
      where: { id: existing.id },
      data: {
        bankName,
        accountName,
        accountNumber,
        ifscCode,
        // Editing beneficiary details should require re-verification.
        isVerified: false,
        verifiedAt: null,
        providerStatusCode: null,
        providerResponse: Prisma.JsonNull,
      },
    });

    res.json(updated);
  } catch (err: any) {
    console.error("[BankAccounts] Update failed:", err);
    res.status(500).json({ error: err.message || "Failed to update bank account" });
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
