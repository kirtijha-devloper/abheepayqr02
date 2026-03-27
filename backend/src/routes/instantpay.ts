import { Router } from "express";
import { prisma } from "../index";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { triggerTransactionCallback } from "../utils/callback";

const router = Router();

const INSTANTPAY_BASE = process.env.INSTANTPAY_BASE_URL || "https://api.instantpay.in";
const API_KEY = process.env.INSTANTPAY_API_KEY || "";
const CLIENT_ID = process.env.INSTANTPAY_CLIENT_ID || "";

async function ipPost(endpoint: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${INSTANTPAY_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "x-client-id": CLIENT_ID,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function ipGet(endpoint: string): Promise<any> {
  const res = await fetch(`${INSTANTPAY_BASE}${endpoint}`, {
    method: "GET",
    headers: { "x-api-key": API_KEY, "x-client-id": CLIENT_ID },
  });
  return res.json();
}

// Helper to deduct funds and trigger commission
async function handlePaidService(
  userId: string,
  amount: number,
  serviceKey: string,
  result: any,
  txnData: any
) {
  if (result.status === "success" || result.status === "pending") {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("Wallet not found");

    const newBalance = Number(wallet.balance) - Number(amount);
    if (newBalance < 0) throw new Error("Insufficient balance (concurrent check)");

    await prisma.$transaction([
      prisma.wallet.update({
        where: { userId },
        data: { balance: newBalance },
      }),
      prisma.walletTransaction.create({
        data: {
          toUserId: userId, // Logic: internal "out" is still recorded for auditing
          amount: Number(amount),
          type: "service_usage",
          description: `Service: ${serviceKey.toUpperCase()} - ${txnData.beneficiary || txnData.consumer || ""}`,
          toBalanceAfter: newBalance,
          createdBy: userId,
          reference: result.txnId || result.refId,
        },
      }),
      prisma.transaction.create({
        data: {
          userId,
          serviceType: serviceKey,
          amount: Number(amount),
          status: result.status,
          refId: result.txnId || result.refId || result.clientRefId,
          ...txnData,
        },
      }),
    ]);

    // Trigger the merchant callback if successful/pending
    const txn = await prisma.transaction.findFirst({
        where: { refId: result.txnId || result.refId || result.clientRefId },
        orderBy: { createdAt: 'desc' }
    });
    if (txn) {
        triggerTransactionCallback(txn.id).catch(e => console.error("Callback trigger failed:", e));
    }

    // Trigger commission (silent)
    try {
      await fetch(`${process.env.BACKEND_URL || "http://localhost:4001"}/api/commission/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer INTERNAL` }, // Should we use internal key?
        body: JSON.stringify({ service_key: serviceKey, transaction_amount: amount }),
      });
    } catch (e) {
      console.error("Commission trigger failed:", e);
    }
  }
}

// ─── AePS ───────────────────────────────────────────────────────────────────

router.get("/aeps/bank-list", requireAuth, async (_req, res) => {
  try { res.json(await ipGet("/v1/aeps/bank-list")); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/aeps/:action", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await ipPost(`/v1/aeps/${req.params.action}`, req.body);
    // AePS is usually credit (Withdrawal) or info. 
    // If it's cash_withdrawal, we should credit the user wallet.
    if (req.params.action === "cash_withdrawal" && result.status === "success") {
      const amount = Number(req.body.amount);
      const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
      const newBalance = Number(wallet?.balance ?? 0) + amount;
      await prisma.$transaction([
        prisma.wallet.update({ where: { userId: req.userId! }, data: { balance: newBalance } }),
        prisma.walletTransaction.create({
          data: {
            toUserId: req.userId!,
            amount,
            type: "aeps_withdrawal",
            toBalanceAfter: newBalance,
            createdBy: req.userId!,
            reference: result.txnId
          }
        }),
        prisma.transaction.create({
          data: {
            userId: req.userId!,
            serviceType: "aeps",
            amount,
            status: "success",
            refId: result.txnId,
            beneficiary: req.body.aadhaar_number
          }
        })
      ]);
    }
    res.json(result);
  }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── DMT ────────────────────────────────────────────────────────────────────

router.post("/dmt/remitter-profile", requireAuth, async (req, res) => {
  try { res.json(await ipPost("/v1/remittance/remitter-profile", req.body)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/dmt/remitter-registration", requireAuth, async (req, res) => {
  try { res.json(await ipPost("/v1/remittance/remitter-registration", req.body)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/dmt/remitter-registration-verify", requireAuth, async (req, res) => {
  try { res.json(await ipPost("/v1/remittance/remitter-registration-verify", req.body)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/dmt/bank-details", requireAuth, async (req, res) => {
  try { res.json(await ipPost("/v1/remittance/bank-details", req.body)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/dmt/beneficiary-registration", requireAuth, async (req, res) => {
  try { res.json(await ipPost("/v1/remittance/beneficiary-registration", req.body)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/dmt/beneficiary-registration-verify", requireAuth, async (req, res) => {
  try { res.json(await ipPost("/v1/remittance/beneficiary-registration-verify", req.body)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/dmt/beneficiary-delete", requireAuth, async (req, res) => {
  try { res.json(await ipPost("/v1/remittance/beneficiary-delete", req.body)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/dmt/generate-otp", requireAuth, async (req, res) => {
  try { res.json(await ipPost("/v1/remittance/generate-transaction-otp", req.body)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/dmt/transaction", requireAuth, async (req: AuthRequest, res) => {
  try {
    const amount = Number(req.body.amount);
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
    if (!wallet || Number(wallet.balance) < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    const result = await ipPost("/v1/remittance/transaction", {
      ...req.body,
      clientRefId: `DMT_${Date.now()}_${req.userId?.slice(0, 6)}`,
    });

    await handlePaidService(req.userId!, amount, "dmt", result, {
      beneficiary: req.body.beneficiaryName || req.body.beneficiaryId,
    });

    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── BBPS ───────────────────────────────────────────────────────────────────

router.post("/bbps/fetch-biller", requireAuth, async (req, res) => {
  try { res.json(await ipPost("/v1/bbps/fetch-biller", req.body)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/bbps/fetch-bill", requireAuth, async (req, res) => {
  try { res.json(await ipPost("/v1/bbps/fetch-bill", req.body)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/bbps/pay-bill", requireAuth, async (req: AuthRequest, res) => {
  try {
    const amount = Number(req.body.amount);
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
    if (!wallet || Number(wallet.balance) < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    const result = await ipPost("/v1/bbps/pay-bill", {
      ...req.body,
      clientRefId: `BBPS_${Date.now()}_${req.userId?.slice(0, 6)}`,
    });

    await handlePaidService(req.userId!, amount, "bbps", result, {
      category: req.body.category,
      provider: req.body.billerId,
      consumer: req.body.consumerNumber,
    });

    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/bbps/recharge", requireAuth, async (req: AuthRequest, res) => {
  try {
    const amount = Number(req.body.amount);
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
    if (!wallet || Number(wallet.balance) < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    const result = await ipPost("/v1/bbps/recharge", {
      ...req.body,
      clientRefId: `RCH_${Date.now()}_${req.userId?.slice(0, 6)}`,
    });

    await handlePaidService(req.userId!, amount, "recharge", result, {
      provider: req.body.billerId,
      consumer: req.body.mobile_number,
    });

    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Payout ─────────────────────────────────────────────────────────────────

router.get("/payout/bank-list", requireAuth, async (_req, res) => {
  try { res.json(await ipGet("/v1/payouts/bank-list")); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/payout/bank-accounts", requireAuth, async (req: AuthRequest, res) => {
  try {
    const amount = Number(req.body.amount);
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
    if (!wallet || Number(wallet.balance) < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    const result = await ipPost("/v1/payouts/bank-accounts", {
      ...req.body,
      clientRefId: `PYT_${Date.now()}_${req.userId?.slice(0, 6)}`,
    });

    await handlePaidService(req.userId!, amount, "payout", result, {
      type: "bank",
      beneficiary: req.body.beneficiary_name || req.body.account_number,
      bank: req.body.ifsc_code,
    });

    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/payout/upi-vpa", requireAuth, async (req: AuthRequest, res) => {
  try {
    const amount = Number(req.body.amount);
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
    if (!wallet || Number(wallet.balance) < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    const result = await ipPost("/v1/payouts/upi-vpa", {
      ...req.body,
      clientRefId: `UPI_${Date.now()}_${req.userId?.slice(0, 6)}`,
    });

    await handlePaidService(req.userId!, amount, "payout", result, {
      type: "upi",
      beneficiary: req.body.vpa,
    });

    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Verification ───────────────────────────────────────────────────────────

router.post("/verify/aadhaar-send-otp", requireAuth, async (req, res) => {
  try { res.json(await ipPost("/v1/identity/aadhaar-offline-ekyc-send-otp", req.body)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/verify/aadhaar-verify-otp", requireAuth, async (req, res) => {
  try { res.json(await ipPost("/v1/identity/aadhaar-offline-ekyc-verify-otp", req.body)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/verify/bank-account", requireAuth, async (req, res) => {
  try { res.json(await ipPost("/v1/financial-verification/bank-account", req.body)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/verify/upi", requireAuth, async (req, res) => {
  try { res.json(await ipPost("/v1/financial-verification/vpa", req.body)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Transaction Status ─────────────────────────────────────────────────────

router.post("/txn-status", requireAuth, async (req, res) => {
  try { res.json(await ipPost("/v1/reporting/transaction-status", req.body)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
