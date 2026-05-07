import { prisma } from "../prisma";
import { getBranchXRuntimeConfig } from "../services/branchx.service";
import { syncSingleBranchXPayoutByRequestId } from "../services/payout.service";

let branchXPayoutTimer: NodeJS.Timeout | null = null;

async function runBranchXPayoutSync() {
  const cutoff = new Date(Date.now() - 60_000);
  const pending = await prisma.transaction.findMany({
    where: {
      serviceType: "branchx_payout",
      status: "pending",
      bankRef: { not: null },
      createdAt: { lte: cutoff },
    },
    select: { id: true, bankRef: true },
    take: 100,
    orderBy: { createdAt: "asc" },
  });

  for (const item of pending) {
    if (!item.bankRef) continue;
    try {
      await syncSingleBranchXPayoutByRequestId(item.bankRef);
    } catch (error: any) {
      console.error(`[BranchX Sync] Failed for ${item.id}:`, error.message);
    }
  }
}

export function startBranchXPayoutSyncJob() {
  const config = getBranchXRuntimeConfig();
  if (!config.isConfigured) {
    console.log("[BranchX Sync] Skipped because BranchX config is incomplete");
    return;
  }

  const initialDelay = Math.max(1000, Number(process.env.BRANCHX_PAYOUT_SYNC_INITIAL_DELAY_MS) || 60_000);
  const intervalMs = Math.max(30_000, Number(process.env.BRANCHX_PAYOUT_SYNC_INTERVAL_MS) || 300_000);

  setTimeout(() => {
    runBranchXPayoutSync().catch((error) => {
      console.error("[BranchX Sync] Initial run failed:", error);
    });

    branchXPayoutTimer = setInterval(() => {
      runBranchXPayoutSync().catch((error) => {
        console.error("[BranchX Sync] Interval run failed:", error);
      });
    }, intervalMs);
  }, initialDelay);
}

export function stopBranchXPayoutSyncJob() {
  if (branchXPayoutTimer) {
    clearInterval(branchXPayoutTimer);
    branchXPayoutTimer = null;
  }
}
