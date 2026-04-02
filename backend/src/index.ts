import "dotenv/config";
import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);
import path from "path";
import fs from "fs";

// Routes
import authRoutes from "./routes/auth";
import walletRoutes from "./routes/wallet";
import usersRoutes from "./routes/users";
import transactionsRoutes from "./routes/transactions";
import instantpayRoutes from "./routes/instantpay";
import commissionRoutes from "./routes/commission";
import fundRequestRoutes from "./routes/fundRequests";
import notificationsRoutes from "./routes/notifications";
import statsRoutes from "./routes/stats";
import kycRoutes from "./routes/kyc";
import supportRoutes from "./routes/support";
import qrcodeRoutes from "./routes/qrcodes";
import reportRoutes from "./routes/reports";
import settingsRoutes from "./routes/settings";
import bankAccountsRoutes from "./routes/bankAccounts";
import callbackLogsRoutes from "./routes/callbackLogs";

export const prisma = new PrismaClient();

const app = express();

// Ensure uploads directory exists (Try-Catch for Vercel read-only system)
try {
  const uploadsDir = path.join(__dirname, "../uploads/qrcodes");
  if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  console.warn("Could not create uploads directory (Expected on Vercel)");
}

const PORT = process.env.PORT || 4001;

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "http://localhost:5173",
    "http://localhost:3000",
    "https://ebazars.in",
    "http://ebazars.in",
    "https://kailasha247.com",
    "http://kailasha247.com"
  ],
  credentials: true,
}));

app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Health check
app.get("/health", (_req, res) => {
  const msg = `[${new Date().toISOString()}] Health check hit from ${_req.ip}`;
  console.log(msg);
  res.json({ status: "ok", time: new Date().toISOString() });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/instantpay", instantpayRoutes);
app.use("/api/commission", commissionRoutes);
app.use("/api/fund-requests", fundRequestRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/qrcodes", qrcodeRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/bank-accounts", bankAccountsRoutes);
app.use("/api/callback-logs", callbackLogsRoutes);

app.listen(PORT, () => {
  console.log(`✅ AbheePay backend running on http://localhost:${PORT}`);
});

export default app;
