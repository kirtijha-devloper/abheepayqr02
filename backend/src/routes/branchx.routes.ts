import { Request, Response, Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { getPayoutQuote, submitPayoutToBranchX, finalizeBranchXPayout } from "../services/payout.service";
import { normalizeBranchXResponse } from "../services/branchx.service";

const router = Router();
const callbackRouter = Router();

router.get("/payout/quote", requireAuth, async (req: AuthRequest, res) => {
  try {
    const amount = Number(req.query.amount || 0);
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: "Valid amount is required" });
    }

    const quote = await getPayoutQuote(req.userId!, amount);
    res.json({ success: true, quote });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/payout/beneficiaries", requireAuth, async (req: AuthRequest, res) => {
  try {
    const beneficiaries = await prisma.merchantBankAccount.findMany({
      where: { userId: req.userId!, isVerified: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      beneficiaries: beneficiaries.map((item) => ({
        id: item.id,
        userId: item.userId,
        payeeName: item.accountName,
        accountNo: item.accountNumber,
        bankIfsc: item.ifscCode,
        bankName: item.bankName,
        isVerified: item.isVerified,
        verifiedAt: item.verifiedAt,
        providerRef: item.providerRef,
        providerStatusCode: item.providerStatusCode,
        providerResponse: item.providerResponse,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Local verification placeholder so payout flow can enforce verified beneficiaries.
router.post("/payout/beneficiaries/:id/verify", requireAuth, async (req: AuthRequest, res) => {
  try {
    const beneficiary = await prisma.merchantBankAccount.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!beneficiary) {
      return res.status(404).json({ success: false, error: "Beneficiary not found" });
    }

    const updated = await prisma.merchantBankAccount.update({
      where: { id: beneficiary.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        providerRef: beneficiary.providerRef || `LOCAL-VERIFY-${Date.now()}`,
        providerStatusCode: "TXN",
        providerResponse: req.body && Object.keys(req.body).length > 0 ? req.body : { verified: true, mode: "local" },
      },
    });

    res.json({
      success: true,
      beneficiary: {
        id: updated.id,
        userId: updated.userId,
        payeeName: updated.accountName,
        accountNo: updated.accountNumber,
        bankIfsc: updated.ifscCode,
        bankName: updated.bankName,
        isVerified: updated.isVerified,
        verifiedAt: updated.verifiedAt,
        providerRef: updated.providerRef,
        providerStatusCode: updated.providerStatusCode,
        providerResponse: updated.providerResponse,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/payout", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await submitPayoutToBranchX({
      userId: req.userId!,
      amount: Number(req.body.amount || 0),
      beneficiaryId: String(req.body.beneficiaryId || ""),
      tpin: String(req.body.tpin || ""),
      confirmVerified: Boolean(req.body.confirmVerified),
      remark: req.body.remark,
      transferMode: req.body.transferMode,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

const handleBranchXCallback = async (payload: any, req: Request, res: Response) => {
  const requestId = String(payload.requestId || payload.requestid || "");
  const opRefId = String(payload.opRefId || payload.oprefid || "");
  const apiTxnId = String(payload.apiTxnId || payload.apitxnid || "");
  const candidateIds = [requestId, opRefId, apiTxnId].filter(Boolean);
  const normalized = normalizeBranchXResponse(payload);

  const matchedTxn = candidateIds.length
    ? await prisma.transaction.findFirst({
        where: {
          serviceType: "branchx_payout",
          bankRef: { in: candidateIds },
        },
      })
    : null;

  const audit = await prisma.payoutCallbackAudit.create({
    data: {
      requestId: requestId || null,
      opRefId: opRefId || null,
      apiTxnId: apiTxnId || null,
      method: req.method,
      sourceIp: req.ip || null,
      forwardedFor: String(req.headers["x-forwarded-for"] || ""),
      userAgent: String(req.headers["user-agent"] || ""),
      rawStatus: normalized.rawStatus || null,
      normalizedStatus: normalized.normalizedStatus,
      payload,
      matchedTxnId: matchedTxn?.id || null,
    },
  });

  if (!matchedTxn) {
    return res.status(200).json({
      success: true,
      message: "BranchX callback received",
      accepted: true,
      matched: false,
      finalized: false,
      normalizedStatus: normalized.normalizedStatus,
      auditId: audit.id,
      requestId: requestId || opRefId || apiTxnId || null,
    });
  }

  const settlement = await finalizeBranchXPayout(matchedTxn.id, payload, "callback");

  await prisma.transaction.update({
    where: { id: matchedTxn.id },
    data: {
      callbackStatus: normalized.rawStatus || normalized.normalizedStatus,
      callbackData: payload,
      callbackReceivedAt: new Date(),
      callbackRequestId: requestId || null,
      callbackOpRefId: opRefId || null,
      callbackApiTxnId: apiTxnId || null,
    },
  });

  return res.status(200).json({
    success: true,
    message: "BranchX callback received",
    accepted: true,
    matched: true,
    finalized: settlement.finalized,
    normalizedStatus: settlement.status,
    auditId: audit.id,
    requestId: requestId || opRefId || apiTxnId || null,
  });
};

callbackRouter.get("/payment/v2/payout/callback", async (req: Request, res: Response) => {
  await handleBranchXCallback(req.query || {}, req, res);
});

callbackRouter.post("/payment/v2/payout/callback", async (req: Request, res: Response) => {
  await handleBranchXCallback({ ...(req.query || {}), ...(req.body || {}) }, req, res);
});

export { callbackRouter };
export default router;
