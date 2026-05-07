import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { prisma } from "../prisma";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/auth";
import { triggerTransactionCallback } from "../utils/callback";

const reportLogPath = path.join(__dirname, "../mapping_trace.txt");

const router = Router();
const DEFAULT_ADMIN_LEDGER_ROLES = ["admin", "staff", "master", "merchant", "branch"];
const DEFAULT_ADMIN_LEDGER_TRANSACTION_TYPES = [
  "bank_deposit",
  "branchx_payout",
  "branchx_payout_debit",
  "branchx_payout_refund",
  "commission",
  "fund_request_approved",
  "fund_request_failed",
  "fund_request_pending",
  "payout",
  "pg_add",
  "qr_settlement_credit",
  "refund",
  "top_up",
  "transfer",
  "wallet",
];

const HIDDEN_LEDGER_TRANSACTION_TYPES = new Set([
  "hold",
  "payout",
  "pg_add",
  "qr_settlement_credit",
  "refund",
  "top_up",
  "transfer",
  "transfer_credit",
  "transfer_hold",
  "unhold",
]);
// On Vercel, we MUST use /tmp for uploads
const uploadDest = process.env.VERCEL ? "/tmp" : "uploads/";
const upload = multer({ dest: uploadDest });

router.get("/mapping-trace", requireAuth, async (_req: AuthRequest, res) => {
  try {
    if (!fs.existsSync(reportLogPath)) {
      return res.json({ entries: [] });
    }
    const content = fs.readFileSync(reportLogPath, "utf8");
    const rawLines = content.trim().split(/\r?\n/).filter(Boolean);
    const tail = rawLines.slice(-50).reverse();
    const entries = tail.map(line => {
      const regex = /^\[(.*?)\]\s+TID:\s*([^\s]+)\s+->\s+(Merchant:\s*(.*?)\s+\(([^)]+)\)|NOT MATCHED)/i;
      const match = line.match(regex);
      if (match) {
        if (match[3]) {
          return {
            timestamp: match[1],
            tid: match[2],
            merchantName: match[3],
            merchantId: match[4],
            matched: true,
            raw: line
          };
        }
        return {
          timestamp: match[1],
          tid: match[2],
          merchantName: null,
          merchantId: null,
          matched: false,
          raw: line
        };
      }
      return { timestamp: null, tid: null, merchantName: null, merchantId: null, matched: false, raw: line };
    });
    res.json({ entries });
  } catch (error: any) {
    console.error("Failed to read mapping trace:", error);
    res.status(500).json({ error: "Unable to read mapping trace" });
  }
});

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const { limit = "50", status } = req.query;
  const numericLimit = Math.min(Math.max(parseInt(limit as string, 10) || 50, 10), 200);

  try {
    const isAdmin = req.userRole === "admin" || (req.userRole === "staff" && req.permissions?.canViewReports);
    const isMerchant = req.userRole === "merchant";
    const isMaster = req.userRole === "master";

    const where: any = { provider: "Bank Report" };
    if (isAdmin) {
        // Admin sees all
    } else if (isMaster) {
        const myProfile = await prisma.profile.findUnique({ where: { userId: req.userId! } });
        const merchantProfiles = await prisma.profile.findMany({
            where: { parentId: myProfile?.id },
            select: { userId: true }
        });
        const merchantIds = merchantProfiles.map(p => p.userId);
        where.userId = { in: [...merchantIds, req.userId!] };
    } else if (isMerchant) {
        const myProfile = await prisma.profile.findUnique({ where: { userId: req.userId! } });
        const downlineProfiles = await prisma.profile.findMany({
            where: { parentId: myProfile?.id },
            select: { userId: true }
        });
        const downlineIds = downlineProfiles.map(p => p.userId);
        where.userId = { in: [...downlineIds, req.userId!] };
    }

    if (status && (status as string).toLowerCase() !== "all") {
      where.status = status;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: numericLimit,
    });

    const stats = transactions.reduce(
      (acc, txn) => {
        const amount = Number(txn.amount) || 0;
        acc.totalVolume += amount;
        acc.statusCounts[(txn.status || "pending").toLowerCase()] =
          (acc.statusCounts[(txn.status || "pending").toLowerCase()] || 0) + 1;
        return acc;
      },
      { totalVolume: 0, statusCounts: {} as Record<string, number> }
    );

    res.json({
      transactions,
      stats: {
        totalCount: transactions.length,
        totalVolume: Number(stats.totalVolume.toFixed(2)),
        statusCounts: stats.statusCounts,
      },
    });
  } catch (error: any) {
    console.error("Failed to fetch report transactions:", error);
    res.status(500).json({ error: "Unable to load reports" });
  }
});

router.post("/upload", requireAuth, upload.single("report"), async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin" && req.userRole !== "merchant" && req.userRole !== "staff" && req.userRole !== "master") {
        return res.status(403).json({ error: "Forbidden" });
    }
    if (req.userRole === "staff" && !req.permissions?.canViewReports) {
        return res.status(403).json({ error: "Permission denied" });
    }
  } catch (e) {
    return res.status(500).json({ error: "Role check failed" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = req.file.path;

  try {
    const logMsg = `[${new Date().toISOString()}] Upload starting for file: ${req.file.originalname} (path: ${filePath})\n`;
    if (!process.env.VERCEL) {
        fs.appendFileSync("upload_debug.log", logMsg);
    }
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with headers mapped to lowercase and trimmed
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);
    
    // Normalize headers: lowercase and trim
    const results = rawData.map(row => {
        const normalizedRow: any = {};
        for (const key in row) {
            normalizedRow[key.trim().toLowerCase()] = row[key];
        }
        return normalizedRow;
    });

    if (results.length > 0) {
        // Only write debug files locally
        if (!process.env.VERCEL) {
            fs.writeFileSync("last_report_debug.json", JSON.stringify({
                headers: Object.keys(rawData[0]),
                normalizedHeaders: Object.keys(results[0]),
                sampleRows: results.slice(0, 10)
            }, null, 2));
        }
    }

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Fuzzy header finding helper
    const findValueByName = (rowObj: any, keywords: string[]) => {
      for (const key of Object.keys(rowObj)) {
        if (keywords.some(kw => key.includes(kw))) return rowObj[key];
      }
      return '';
    };

    // Pre-fetch all QRs for efficient matching
    const allQrs = await prisma.qrCode.findMany({ 
        where: { NOT: { merchantId: null } },
        select: { id: true, tid: true, upiId: true, merchantId: true, merchantName: true } 
    });

    for (const row of results) {
      try {
        const rawTid = findValueByName(row, ['terminal id', 'tid', 'terminal']);
        const rawAmount = findValueByName(row, ['transaction amount', 'amount', 'amt', 'value']);
        const rawRrn = findValueByName(row, ['rrn no', 'rrn', 'ref no', 'utr', 'refid']);
        const rawStatus = findValueByName(row, ['transaction state', 'status', 'state', 'result']);
        const rawDate = findValueByName(row, ['transaction date', 'date', 'txn date']);
        const rawTime = findValueByName(row, ['transaction time', 'time', 'txn time']);
        const rawPayer = findValueByName(row, ['payer', 'customer', 'beneficiary', 'remitter', 'sender', 'done by', 'name']);
        const rawDesc = findValueByName(row, ['description', 'remarks', 'narrative']);
        const rawMobile = findValueByName(row, ['mobile', 'phone', 'contact']);
        const rawMintoakId = findValueByName(row, ['mintoak transaction id', 'mintoak id', 'aggregator id']);

        const tid = rawTid ? rawTid.toString().trim() : '';
        const amount = rawAmount ? rawAmount.toString().trim() : '';
        const rrn = rawRrn ? rawRrn.toString().trim() : '';

        if (!tid || !amount || !rrn) {
            skippedCount++;
            continue;
        }

        // check for duplicates by RRN
        const existing = await prisma.transaction.findFirst({
            where: { refId: rrn }
        });
        
        if (existing) {
            skippedCount++;
            continue;
        }

        let merchantId: string = req.userId!; // default to uploader
        
        // Match QR by EXHAUSTIVE multi-ID search
        const matchedQr = allQrs.find(q => {
            const dbTid = (q.tid || '').toString().toLowerCase();
            const dbUpi = (q.upiId || '').toString().toLowerCase();
            const reportTid = tid.toLowerCase();
            
            // 1. Direct match
            if (dbTid === reportTid) return true;
            if (dbUpi.includes(reportTid) && reportTid.length >= 6) return true;
            
            // 2. Extracts all 8-15 digit sequences from the DB upiId
            const numericSequences = dbUpi.match(/\d{8,16}/g) || [];
            if (numericSequences.some(seq => seq.includes(reportTid) || reportTid.includes(seq))) return true;

            // 3. Last 8 digits of everything
            if (dbTid.endsWith(reportTid) || reportTid.endsWith(dbTid)) {
                if (Math.min(dbTid.length, reportTid.length) >= 6) return true;
            }

            return false;
        });

        if (matchedQr && matchedQr.merchantId) {
            merchantId = matchedQr.merchantId;
            if (!process.env.VERCEL) {
                fs.appendFileSync("mapping_trace.txt", `[${new Date().toISOString()}] TID: ${tid} -> Merchant: ${matchedQr.merchantName} (${merchantId})\n`);
            }
        } else {
            if (!process.env.VERCEL) {
                fs.appendFileSync("mapping_trace.txt", `[${new Date().toISOString()}] TID: ${tid} -> NOT MATCHED (Sent to Admin: ${merchantId})\n`);
            }
        }

        let finalStatus = "Pending";
        if (rawStatus) {
            const s = rawStatus.toString().toLowerCase();
            if (s.includes("success") || s === "completed") finalStatus = "Completed";
            else if (s.includes("fail") || s.includes("decline") || s.includes("error")) finalStatus = "Failed";
            else finalStatus = rawStatus.toString().trim();
        }

        let dateToSave = new Date();
        if (rawDate) {
           dateToSave = new Date(`${rawDate} ${rawTime}`.trim());
           if (isNaN(dateToSave.getTime())) {
              dateToSave = new Date(rawDate);
              if (isNaN(dateToSave.getTime())) dateToSave = new Date();
           }
        }

        // Create transaction
        const newTxn = await prisma.transaction.create({
          data: {
            userId: merchantId,
            serviceType: "qr_settlement",
            amount: Number(amount) || 0,
            status: finalStatus,
            refId: rrn,
            clientRefId: rawMintoakId.toString().trim() || null,
            createdAt: dateToSave,
            category: "QR Payment",
            provider: "Bank Report",
            type: "credit",
            description: rawDesc ? rawDesc.toString().trim() : null,
            sender: rawPayer ? rawPayer.toString().trim() : null,
            consumer: rawMobile ? rawMobile.toString().trim() : null,
            requestPayload: {
              source: "bank_report_upload",
              qrTid: tid,
              qrUpiId: matchedQr?.upiId || null,
              matchedQrId: matchedQr?.id || null,
            },
            providerPayload: {
              source: "bank_report_upload",
              qrTid: tid,
              row,
            }
          }
        });

        if (newTxn.status === "Completed") {
            triggerTransactionCallback(newTxn.id).catch(e => console.error("Callback failed:", e));
        }

        processedCount++;
      } catch (err) {
        console.error("Error processing row:", err);
        errorCount++;
      }
    }

    // Cleanup
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    res.json({
      message: "Report processed successfully",
      processed: processedCount,
      skipped: skippedCount,
      errors: errorCount
    });
  } catch (e: any) {
    if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
    }
    if (!process.env.VERCEL) {
        fs.appendFileSync("upload_debug.log", `[${new Date().toISOString()}] UPLOAD ERROR: ${e.message}\n`);
    }
    console.error("Report upload error:", e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/reports/admin/fund-requests — Admin: all fund requests across all levels
router.get("/admin/fund-requests", requireAuth, async (req: AuthRequest, res) => {
  if (req.userRole !== "admin" && !req.permissions?.canViewReports) {
      return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const requests = await prisma.fundRequest.findMany({
      include: { bankAccount: true },
      orderBy: { createdAt: "desc" },
    });

    const userIds = new Set<string>();
    requests.forEach(r => {
      userIds.add(r.requesterId);
      if (r.approvedBy) userIds.add(r.approvedBy);
    });

    const profiles = await prisma.profile.findMany({ where: { userId: { in: Array.from(userIds) } } });
    const roles = await prisma.userRole.findMany({ where: { userId: { in: Array.from(userIds) } } });
    const profileMap = new Map(profiles.map(p => [p.userId, p]));
    const roleMap = new Map(roles.map(r => [r.userId, r.role]));

    const enriched = requests.map(r => ({
      ...r,
      amount: Number(r.amount),
      requesterName: profileMap.get(r.requesterId)?.fullName || "Unknown",
      requesterRole: roleMap.get(r.requesterId) || "—",
      approverName: r.approvedBy ? profileMap.get(r.approvedBy)?.fullName || "—" : null,
      bankName: r.bankAccount?.bankName || "—",
    }));

    res.json(enriched);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/reports/admin/settlements — Admin: all payout settlement transactions across all levels
router.get("/admin/settlements", requireAuth, async (req: AuthRequest, res) => {
  if (req.userRole !== "admin" && !req.permissions?.canViewReports) {
      return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const settlements = await prisma.transaction.findMany({
      where: {
        serviceType: { in: ["payout", "branchx_payout"] },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });
    res.json(
      settlements.map((settlement) => ({
        ...settlement,
        amount: Number(settlement.amount || 0),
        fee: Number(settlement.fee || 0),
        userName: settlement.user?.profile?.fullName || settlement.user?.profile?.businessName || settlement.user?.email || "Unknown",
      }))
    );
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/reports/admin/ledger - unified admin ledger across all transaction sources
router.get("/admin/ledger", requireAuth, async (req: AuthRequest, res) => {
  if (req.userRole !== "admin" && !req.permissions?.canViewReports) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const roleFilter = typeof req.query.role === "string" ? req.query.role.trim().toLowerCase() : "";
    const typeFilter = typeof req.query.transactionType === "string" ? req.query.transactionType.trim().toLowerCase() : "";
    const startDateRaw = typeof req.query.startDate === "string" ? req.query.startDate.trim() : "";
    const endDateRaw = typeof req.query.endDate === "string" ? req.query.endDate.trim() : "";

    const startDate = startDateRaw ? new Date(startDateRaw) : null;
    const endDate = endDateRaw ? new Date(endDateRaw) : null;

    if (startDate && Number.isNaN(startDate.getTime())) {
      return res.status(400).json({ error: "Invalid startDate" });
    }
    if (endDate && Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "Invalid endDate" });
    }

    const walletWhere: any = {};
    const transactionWhere: any = {};
    const fundRequestWhere: any = {};

    if (startDate || endDate) {
      const createdAt: any = {};
      if (startDate) createdAt.gte = startDate;
      if (endDate) {
        const inclusiveEndDate = new Date(endDate);
        inclusiveEndDate.setHours(23, 59, 59, 999);
        createdAt.lte = inclusiveEndDate;
      }
      walletWhere.createdAt = createdAt;
      transactionWhere.createdAt = createdAt;
      fundRequestWhere.createdAt = createdAt;
    }

    const results = await Promise.allSettled([
      prisma.user.findMany({
        include: { profile: true, roles: true, wallet: true },
      }),
      prisma.userRole.findMany({
        select: { userId: true, role: true },
      }),
      prisma.walletTransaction.findMany({
        where: walletWhere,
        orderBy: { createdAt: "desc" },
        take: 2000,
      }),
      prisma.transaction.findMany({
        where: transactionWhere,
        orderBy: { createdAt: "desc" },
        take: 2000,
      }),
      prisma.fundRequest.findMany({
        where: fundRequestWhere,
        include: { bankAccount: true },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
    ]);

    const users = results[0].status === "fulfilled" ? results[0].value : [];
    const roleRows = results[1].status === "fulfilled" ? results[1].value : [];
    const walletTransactions = results[2].status === "fulfilled" ? results[2].value : [];
    const serviceTransactions = results[3].status === "fulfilled" ? results[3].value : [];
    const fundRequests = results[4].status === "fulfilled" ? results[4].value : [];

    const userMap = new Map(
      users.map((user) => [
        user.id,
        {
          id: user.id,
          role: (user.roles[0]?.role || "").toLowerCase(),
          name: user.profile?.fullName || user.profile?.businessName || user.email,
          phone: user.profile?.phone || "",
          email: user.email,
          walletBalance: Number(user.wallet?.balance ?? 0),
          eWalletBalance: Number(user.wallet?.eWalletBalance ?? 0),
          holdBalance: Number(user.wallet?.holdBalance ?? 0),
        },
      ])
    );
    const availableRoles = Array.from(
      new Set([
        ...DEFAULT_ADMIN_LEDGER_ROLES,
        ...roleRows
          .map((roleRow) => String(roleRow.role || "").toLowerCase())
          .filter(Boolean),
      ])
    ).sort((a, b) => a.localeCompare(b));

    const ledgerRows = [
      ...walletTransactions.map((txn) => {
        const primaryUserId = txn.toUserId || txn.fromUserId || "";
        const primaryUser = userMap.get(primaryUserId);
        const amount = Number(txn.amount || 0);
        const balanceAfter =
          txn.fromUserId && txn.fromUserId === primaryUserId
            ? Number(txn.fromBalanceAfter ?? txn.toBalanceAfter ?? 0)
            : Number(txn.toBalanceAfter ?? txn.fromBalanceAfter ?? 0);

        return {
          id: `wallet_${txn.id}`,
          source: "wallet",
          sourceLabel: "Wallet",
          createdAt: txn.createdAt,
          userId: primaryUserId,
          userName: primaryUser?.name || "Unknown User",
          userPhone: primaryUser?.phone || "",
          userEmail: primaryUser?.email || "",
          role: primaryUser?.role || "unknown",
          transactionType: (txn.type || "wallet").toLowerCase(),
          rawTransactionType: txn.type || "wallet",
          amount,
          direction: amount < 0 ? "debit" : "credit",
          description: txn.description || "Wallet ledger entry",
          reference: txn.reference || txn.id,
          status: "success",
          balanceAfter,
        };
      }),
      ...serviceTransactions.map((txn) => {
        const user = userMap.get(txn.userId);
        const serviceKey = (txn.serviceType || "service").toLowerCase();
        const entryType = (txn.type || "").toLowerCase();
        const combinedType = entryType ? `${serviceKey}_${entryType}` : serviceKey;
        const amount = Number(txn.amount || 0);

        return {
          id: `service_${txn.id}`,
          source: "service",
          sourceLabel: "Service",
          createdAt: txn.createdAt,
          userId: txn.userId,
          userName: user?.name || txn.sender || "Unknown User",
          userPhone: user?.phone || txn.consumer || "",
          userEmail: user?.email || "",
          role: user?.role || "unknown",
          transactionType: combinedType,
          rawTransactionType: combinedType,
          amount,
          direction: entryType === "debit" || amount < 0 ? "debit" : "credit",
          description: txn.description || txn.category || txn.serviceType || "Service transaction",
          reference: txn.refId || txn.clientRefId || txn.id,
          status: txn.status || "pending",
          balanceAfter: null,
        };
      }),
      ...fundRequests.map((request) => {
        const user = userMap.get(request.requesterId);
        const transactionType = `fund_request_${(request.status || "pending").toLowerCase()}`;
        const amount = Number(request.amount || 0);
        const details = [
          request.remarks,
          request.paymentMode ? `Mode: ${request.paymentMode}` : "",
          request.paymentReference ? `Ref: ${request.paymentReference}` : "",
          request.bankAccount?.bankName ? `Bank: ${request.bankAccount.bankName}` : "",
        ]
          .filter(Boolean)
          .join(" | ");

        return {
          id: `fund_${request.id}`,
          source: "fund_request",
          sourceLabel: "Fund Request",
          createdAt: request.createdAt,
          userId: request.requesterId,
          userName: user?.name || "Unknown User",
          userPhone: user?.phone || "",
          userEmail: user?.email || "",
          role: user?.role || "unknown",
          transactionType,
          rawTransactionType: transactionType,
          amount,
          direction: "credit",
          description: details || "Fund request",
          reference: request.paymentReference || request.id,
          status: request.status || "pending",
          balanceAfter: null,
        };
      }),
    ];

    const availableTransactionTypes = Array.from(
      new Set([
        ...DEFAULT_ADMIN_LEDGER_TRANSACTION_TYPES,
        ...ledgerRows
          .map((row) => row.transactionType)
          .filter(Boolean),
      ])
    )
      .map((value) => String(value || "").toLowerCase())
      .filter((value) => value && !HIDDEN_LEDGER_TRANSACTION_TYPES.has(value))
      .sort((a, b) => a.localeCompare(b));

    const filteredRows = ledgerRows
      .filter((row) => (roleFilter ? row.role === roleFilter : true))
      .filter((row) => (typeFilter ? row.transactionType === typeFilter : true))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalAmount = filteredRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const totalCredit = filteredRows.reduce(
      (sum, row) => sum + (row.direction === "credit" ? Math.abs(Number(row.amount) || 0) : 0),
      0
    );
    const totalDebit = filteredRows.reduce(
      (sum, row) => sum + (row.direction === "debit" ? Math.abs(Number(row.amount) || 0) : 0),
      0
    );

    res.json({
      rows: filteredRows,
      availableTransactionTypes,
      filters: {
        roles: availableRoles,
        transactionTypes: availableTransactionTypes,
      },
      summary: {
        totalCount: filteredRows.length,
        totalAmount: Number(totalAmount.toFixed(2)),
        totalCredit: Number(totalCredit.toFixed(2)),
        totalDebit: Number(totalDebit.toFixed(2)),
      },
    });
  } catch (e: any) {
    console.error("Admin ledger fetch failed:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
