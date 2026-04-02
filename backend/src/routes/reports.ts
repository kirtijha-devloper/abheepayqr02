import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { prisma } from "../index";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/auth";
import { triggerTransactionCallback } from "../utils/callback";

const reportLogPath = path.join(__dirname, "../mapping_trace.txt");

const router = Router();
// On Vercel, we MUST use /tmp for uploads
const uploadDest = process.env.VERCEL ? "/tmp" : "uploads/";
const upload = multer({ dest: uploadDest });

router.get("/mapping-trace", requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
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
    const roleRow = await prisma.userRole.findFirst({ where: { userId: req.userId! } });
    const isAdmin = roleRow?.role === "admin";

    const where: any = { provider: "Bank Report" };
    if (!isAdmin) where.userId = req.userId!;
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

router.post("/upload", requireAuth, requireAdmin, upload.single("report"), async (req: AuthRequest, res) => {
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
    
    if (rawData.length > 0) {
        console.log("[REPORT DEBUG] First raw row keys:", Object.keys(rawData[0]));
    }

    // Normalize headers: lowercase and trim
    const results = rawData.map(row => {
        const normalizedRow: any = {};
        for (const key in row) {
            normalizedRow[key.trim().toLowerCase()] = row[key];
        }
        return normalizedRow;
    });

    if (results.length > 0) {
        console.log("[REPORT DEBUG] First normalized row:", results[0]);
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
            consumer: rawMobile ? rawMobile.toString().trim() : null
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

export default router;
