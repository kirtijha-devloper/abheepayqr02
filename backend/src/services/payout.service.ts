import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { getChargeDistribution, roundCurrency } from "../utils/commission";
import { checkBranchXPayoutStatus, normalizeBranchXResponse, submitBranchXPayout } from "./branchx.service";

const DUPLICATE_PAYOUT_WINDOW_MS = 5 * 60 * 1000;

function getPayoutWalletField(role?: string | null) {
  return role === "admin" ? "balance" : "eWalletBalance";
}

async function getUserRole(userId: string) {
  const role = await prisma.userRole.findFirst({ where: { userId } });
  return role?.role || null;
}

export function generateBranchXRequestId() {
  const random = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `BXP-${Date.now()}-${random}`;
}

function getRemainingDuplicateBlockMs(createdAt: Date) {
  const elapsedMs = Date.now() - createdAt.getTime();
  return Math.max(0, DUPLICATE_PAYOUT_WINDOW_MS - elapsedMs);
}

function formatDuplicateWindowMessage(createdAt: Date) {
  const remainingMs = getRemainingDuplicateBlockMs(createdAt);
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return `A payout with the same amount to this beneficiary was already submitted recently. Please wait ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"} before trying again.`;
}

type DuplicatePayoutCheckInput = {
  userId: string;
  amount: number;
  beneficiaryAccountId: string;
};

export async function assertNoRecentDuplicatePayout(input: DuplicatePayoutCheckInput) {
  const recentCutoff = new Date(Date.now() - DUPLICATE_PAYOUT_WINDOW_MS);
  const recentMatch = await prisma.transaction.findFirst({
    where: {
      userId: input.userId,
      serviceType: { in: ["payout", "branchx_payout"] },
      beneficiaryAccountId: input.beneficiaryAccountId,
      amount: roundCurrency(input.amount),
      createdAt: { gte: recentCutoff },
      status: { in: ["pending", "success"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });

  if (recentMatch) {
    throw new Error(formatDuplicateWindowMessage(recentMatch.createdAt));
  }
}

function sanitizeBranchXRequestPayload(input: {
  amount: number;
  beneficiaryId: string;
  remark?: string;
  transferMode?: string;
}) {
  return {
    amount: roundCurrency(input.amount),
    beneficiaryId: input.beneficiaryId,
    remark: (input.remark || "").trim() || null,
    transferMode: (input.transferMode || "IMPS").toUpperCase(),
  };
}

export async function verifyUserTpin(userId: string, tpin: string) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { tpinHash: true },
  });

  if (!profile?.tpinHash) {
    return { ok: false, message: "Transaction PIN is not set for this account" };
  }

  const matches = await bcrypt.compare(tpin, profile.tpinHash);
  return matches
    ? { ok: true, message: "" }
    : { ok: false, message: "Invalid transaction PIN" };
}

export async function getPayoutQuote(userId: string, amount: number, serviceKey = "payout") {
  const quote = await getChargeDistribution(prisma, {
    userId,
    serviceKey,
    amount,
  });

  return {
    amount: roundCurrency(amount),
    charge: roundCurrency(quote.totalCharge),
    netAmount: roundCurrency(quote.netAmount),
    walletRequired: roundCurrency(amount),
  };
}

export async function finalizeBranchXPayout(transactionId: string, providerPayload: any, origin: "callback" | "poll" | "submit") {
  const txn = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!txn) {
    return { matched: false, finalized: false, status: "FAILED" as const };
  }

  const normalized = normalizeBranchXResponse(providerPayload);
  const now = new Date();

  await prisma.providerAuditLog.create({
    data: {
      transactionId,
      serviceType: txn.serviceType,
      action: origin === "callback" ? "CALLBACK" : origin === "poll" ? "POLL" : "SUBMIT_FINALIZE",
      requestId: txn.bankRef,
      provider: "BranchX",
      responsePayload: providerPayload,
      status: normalized.normalizedStatus,
      message: normalized.message,
    },
  });

  if (normalized.normalizedStatus === "PENDING") {
    await prisma.transaction.update({
      where: { id: txn.id },
      data: {
        responsePayload: providerPayload,
        providerStatus: normalized.normalizedStatus,
        callbackPayload: origin === "callback" ? providerPayload : txn.callbackPayload,
        callbackStatus: normalized.rawStatus || normalized.normalizedStatus,
        callbackData: providerPayload,
        callbackReceivedAt: now,
      },
    });
    return { matched: true, finalized: false, status: "PENDING" as const };
  }

  if (txn.status !== "pending") {
    return {
      matched: true,
      finalized: true,
      status: txn.status.toUpperCase() === "SUCCESS" ? ("SUCCESS" as const) : ("FAILED" as const),
    };
  }

  if (normalized.normalizedStatus === "SUCCESS") {
    const amount = Number(txn.amount || 0);
    const charge = Number(txn.fee || 0);
    const { distributions } = await getChargeDistribution(prisma, {
      userId: txn.userId,
      serviceKey: "branchx_payout",
      amount,
    });
    const chargeReference = `branchx_payout_charge_${txn.id}`;

    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: txn.id },
        data: {
          status: "success",
          responsePayload: providerPayload,
          providerResponse: providerPayload,
          providerStatus: normalized.normalizedStatus,
          callbackPayload: origin === "callback" ? providerPayload : txn.callbackPayload,
          callbackStatus: normalized.rawStatus || normalized.normalizedStatus,
          callbackData: providerPayload,
          callbackReceivedAt: now,
        },
      });

      if (charge > 0) {
        for (const dist of distributions) {
          if (dist.amount <= 0) continue;
          const wallet = await tx.wallet.findUnique({ where: { userId: dist.userId } });
          if (!wallet) continue;

          const newBalance = roundCurrency(Number(wallet.balance || 0) + dist.amount);
          await tx.wallet.update({
            where: { userId: dist.userId },
            data: { balance: newBalance },
          });

          await tx.walletTransaction.create({
            data: {
              toUserId: dist.userId,
              fromUserId: txn.userId,
              amount: dist.amount,
              type: "commission",
              description: `BranchX payout fee commission for ${txn.id.slice(0, 8)}`,
              reference: chargeReference,
              toBalanceAfter: newBalance,
              createdBy: txn.userId,
            },
          });
        }
      }

      await tx.notification.create({
        data: {
          userId: txn.userId,
          title: "Payout Completed",
          message: `Your BranchX payout of Rs ${amount.toFixed(2)} has been completed.`,
          type: "success",
          link: origin === "callback" ? "/ledger" : null,
        },
      });
    });

    return { matched: true, finalized: true, status: "SUCCESS" as const };
  }

  const requesterRole = await getUserRole(txn.userId);
  const balanceField = getPayoutWalletField(requesterRole);
  const wallet = await prisma.wallet.findUnique({ where: { userId: txn.userId } });
  const refundAmount = Number(txn.amount || 0);
  const currentBalance = Number(balanceField === "balance" ? wallet?.balance : wallet?.eWalletBalance);
  const newBalance = roundCurrency(currentBalance + refundAmount);

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: txn.id },
      data: {
        status: "failed",
        responsePayload: providerPayload,
        providerResponse: providerPayload,
        providerStatus: normalized.normalizedStatus,
        callbackPayload: origin === "callback" ? providerPayload : txn.callbackPayload,
        callbackStatus: normalized.rawStatus || normalized.normalizedStatus,
        callbackData: providerPayload,
        callbackReceivedAt: now,
        description: normalized.message || txn.description,
      },
    });

    await tx.wallet.update({
      where: { userId: txn.userId },
      data: { [balanceField]: newBalance },
    });

    await tx.walletTransaction.create({
      data: {
        toUserId: txn.userId,
        amount: refundAmount,
        type: "branchx_payout_refund",
        description: `Refund for failed BranchX payout ${txn.id.slice(0, 8)}`,
        toBalanceAfter: newBalance,
        createdBy: txn.userId,
        reference: txn.bankRef || txn.id,
      },
    });

    await tx.notification.create({
      data: {
        userId: txn.userId,
        title: "Payout Failed",
        message: `Your BranchX payout failed and Rs ${refundAmount.toFixed(2)} was refunded.`,
        type: "error",
      },
    });
  });

  return { matched: true, finalized: true, status: "FAILED" as const };
}

export async function syncSingleBranchXPayoutByRequestId(requestId: string) {
  const normalized = await checkBranchXPayoutStatus(requestId);
  const txn = await prisma.transaction.findFirst({
    where: { serviceType: "branchx_payout", bankRef: requestId },
  });

  if (!txn) return { matched: false, finalized: false, status: normalized.normalizedStatus };
  return finalizeBranchXPayout(txn.id, normalized.payload, "poll");
}

export async function submitPayoutToBranchX(input: {
  userId: string;
  amount: number;
  beneficiaryId: string;
  tpin: string;
  confirmVerified: boolean;
  remark?: string;
  transferMode?: string;
}) {
  const { userId, amount, beneficiaryId, tpin, confirmVerified, remark, transferMode } = input;
  const normalizedAmount = roundCurrency(amount);

  if (!confirmVerified) {
    throw new Error("Beneficiary verification confirmation is required");
  }

  const tpinCheck = await verifyUserTpin(userId, tpin);
  if (!tpinCheck.ok) {
    throw new Error(tpinCheck.message);
  }

  const [profile, roleRow, wallet, beneficiary, user] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.userRole.findFirst({ where: { userId } }),
    prisma.wallet.findUnique({ where: { userId } }),
    prisma.merchantBankAccount.findFirst({ where: { id: beneficiaryId, userId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  if (!beneficiary) throw new Error("Beneficiary not found");
  if (!beneficiary.isVerified) throw new Error("Beneficiary is not verified");
  if (!profile?.phone) throw new Error("User profile must have mobile number");
  if (!wallet) throw new Error("Wallet not found");

  await assertNoRecentDuplicatePayout({
    userId,
    amount: normalizedAmount,
    beneficiaryAccountId: beneficiary.id,
  });

  const quote = await getPayoutQuote(userId, normalizedAmount, "branchx_payout");
  if (quote.netAmount <= 0) throw new Error("Net payout amount must be greater than zero");

  const role = roleRow?.role || null;
  const balanceField = getPayoutWalletField(role);
  const currentBalance = Number(balanceField === "balance" ? wallet.balance : wallet.eWalletBalance);
  if (currentBalance < quote.walletRequired) {
    throw new Error("Insufficient wallet balance");
  }

  const requestId = generateBranchXRequestId();
  const newBalance = roundCurrency(currentBalance - quote.walletRequired);
  const purpose = (remark || "Payout").trim();
  const requestPayload = sanitizeBranchXRequestPayload({
    amount: normalizedAmount,
    beneficiaryId: beneficiary.id,
    remark,
    transferMode,
  });

  const createdTxn = await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { userId },
      data: { [balanceField]: newBalance },
    });

    await tx.walletTransaction.create({
      data: {
        fromUserId: userId,
        toUserId: userId,
        amount: -quote.walletRequired,
        type: "branchx_payout_hold",
        description: `BranchX payout reserve for ${beneficiary.bankName}`,
        fromBalanceAfter: newBalance,
        toBalanceAfter: newBalance,
        createdBy: userId,
        reference: requestId,
      },
    });

    return tx.transaction.create({
      data: {
        userId,
        serviceType: "branchx_payout",
        type: "debit",
        amount: quote.walletRequired,
        fee: quote.charge,
        status: "pending",
        description: purpose,
        beneficiary: beneficiary.accountName,
        bank: beneficiary.bankName,
        consumer: profile.phone,
        bankRef: requestId,
        beneficiaryAccountId: beneficiary.id,
        beneficiaryAccountName: beneficiary.accountName,
        beneficiaryAccountNumber: beneficiary.accountNumber,
        beneficiaryIfscCode: beneficiary.ifscCode,
        beneficiaryBankName: beneficiary.bankName,
        payoutBankDetails: JSON.stringify({
          beneficiaryId: beneficiary.id,
          payeeName: beneficiary.accountName,
          accountNo: beneficiary.accountNumber,
          bankIfsc: beneficiary.ifscCode,
          bankName: beneficiary.bankName,
          transferMode: (transferMode || "IMPS").toUpperCase(),
        }),
        requestPayload,
        providerStatus: "PENDING",
      },
    });
  });

  try {
    const provider = await submitBranchXPayout({
      amount: quote.netAmount,
      mobileNumber: profile.phone,
      requestId,
      accountNumber: beneficiary.accountNumber,
      ifscCode: beneficiary.ifscCode,
      beneficiaryName: beneficiary.accountName,
      remitterName: profile.fullName || profile.businessName || user?.email || "User",
      bankName: beneficiary.bankName,
      transferMode: transferMode || "IMPS",
      emailId: user?.email || "",
      purpose,
    });

    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: createdTxn.id },
        data: {
          provider: "BranchX",
          providerPayload: provider.request,
          responsePayload: provider.payload,
          providerResponse: provider.payload,
          providerStatus: provider.normalizedStatus,
          callbackStatus: provider.rawStatus || provider.normalizedStatus,
        },
      }),
      prisma.providerAuditLog.create({
        data: {
          transactionId: createdTxn.id,
          serviceType: "branchx_payout",
          action: "SUBMIT",
          requestId,
          provider: "BranchX",
          requestPayload: provider.request,
          responsePayload: provider.payload,
          status: provider.normalizedStatus,
          message: provider.message,
        },
      }),
    ]);

    if (provider.normalizedStatus === "FAILED") {
      const settlement = await finalizeBranchXPayout(createdTxn.id, provider.payload, "submit");
      return {
        success: false,
        status: "FAILED",
        message: provider.message || "Provider failure message",
        requestId,
        request: { id: createdTxn.id },
        charge: quote.charge,
        netAmount: quote.netAmount,
        providerResponse: provider.payload,
        settlement: { status: settlement.status },
      };
    }

    return {
      success: true,
      status: "PENDING",
      message: "Payout request submitted and is pending callback or status check",
      requestId,
      request: {
        id: createdTxn.id,
        status: "PENDING",
        bankRef: requestId,
      },
      charge: quote.charge,
      netAmount: quote.netAmount,
      providerResponse: provider.payload,
    };
  } catch (error: any) {
    const settlement = await finalizeBranchXPayout(createdTxn.id, { message: error.message, status: "FAILED" }, "submit");
    return {
      success: false,
      message: "BranchX payout request failed",
      requestId,
      settlement: { status: settlement.status },
    };
  }
}
