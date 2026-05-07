type BranchXNormalizedStatus = "SUCCESS" | "FAILED" | "PENDING";

type BranchXResponse = {
  normalizedStatus: BranchXNormalizedStatus;
  rawStatus: string;
  rawStatusCode: string;
  message: string;
  payload: any;
};

const FAILED_STATUS_CODES = new Set(["400", "401", "403", "404", "422", "500"]);
const PENDING_STATUS_CODES = new Set(["200", "OK", "PENDING", "PROCESSING", "IN_PROGRESS", "TUP", "ACCEPTED"]);

function getValue(payload: any, paths: string[]) {
  for (const path of paths) {
    const parts = path.split(".");
    let current = payload;
    for (const part of parts) {
      current = current?.[part];
    }
    if (current !== undefined && current !== null && current !== "") {
      return current;
    }
  }
  return "";
}

export function normalizeBranchXResponse(payload: any): BranchXResponse {
  const rawStatus = String(
    getValue(payload, ["status", "Status", "data.status", "data.Status"]) || ""
  )
    .trim()
    .toUpperCase();
  const rawStatusCode = String(
    getValue(payload, ["statuscode", "statusCode", "data.statuscode", "data.statusCode"]) || ""
  )
    .trim()
    .toUpperCase();
  const message = String(
    getValue(payload, ["message", "msg", "statusdesc", "data.message", "data.statusdesc"]) || ""
  ).trim();

  let normalizedStatus: BranchXNormalizedStatus = "PENDING";

  if (["SUCCESS", "COMPLETED"].includes(rawStatus)) {
    normalizedStatus = "SUCCESS";
  } else if (["FAILED", "FAILURE", "REJECTED", "CANCELLED", "REVERSED", "REFUND"].includes(rawStatus)) {
    normalizedStatus = "FAILED";
  } else if (["PENDING", "PROCESSING", "IN_PROGRESS", "TUP", "ACCEPTED"].includes(rawStatus)) {
    normalizedStatus = "PENDING";
  } else if (!rawStatus && rawStatusCode === "TXN") {
    normalizedStatus = "SUCCESS";
  } else if (!rawStatus && PENDING_STATUS_CODES.has(rawStatusCode)) {
    normalizedStatus = "PENDING";
  } else if (FAILED_STATUS_CODES.has(rawStatusCode)) {
    normalizedStatus = "FAILED";
  }

  return {
    normalizedStatus,
    rawStatus,
    rawStatusCode,
    message,
    payload,
  };
}

function getBranchXConfig() {
  const baseUrl = (process.env.BRANCHX_BASE_URL || "").trim().replace(/\/$/, "");
  const payoutPath = (process.env.BRANCHX_PAYOUT_ENDPOINT || "").trim();
  const statusPath = (process.env.BRANCHX_STATUS_CHECK_ENDPOINT || "").trim();
  const apiToken = (process.env.BRANCHX_API_TOKEN || "").trim();
  const timeoutMs = Math.max(1000, Number(process.env.BRANCHX_TIMEOUT_MS) || 60000);

  return {
    baseUrl,
    payoutUrl: `${baseUrl}${payoutPath}`,
    statusUrl: `${baseUrl}${statusPath}`,
    apiToken,
    timeoutMs,
    latitude: String(process.env.BRANCHX_LATITUDE || "0"),
    longitude: String(process.env.BRANCHX_LONGITUDE || "0"),
    isConfigured: Boolean(baseUrl && payoutPath && statusPath && apiToken),
  };
}

async function postJson(url: string, body: any) {
  const config = getBranchXConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apiToken: config.apiToken,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let payload: any = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }

    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export function getBranchXRuntimeConfig() {
  return getBranchXConfig();
}

export async function submitBranchXPayout(payload: {
  amount: number;
  mobileNumber: string;
  requestId: string;
  accountNumber: string;
  ifscCode: string;
  beneficiaryName: string;
  remitterName: string;
  bankName: string;
  transferMode: string;
  emailId: string;
  purpose: string;
}) {
  const config = getBranchXConfig();
  if (!config.isConfigured) {
    throw new Error("BranchX payout configuration is incomplete");
  }

  const providerPayload = {
    ...payload,
    ifscCode: payload.ifscCode.toUpperCase(),
    transferMode: (payload.transferMode || "IMPS").toUpperCase(),
    latitude: config.latitude,
    longitude: config.longitude,
  };

  const rawPayload = await postJson(config.payoutUrl, providerPayload);
  return {
    request: providerPayload,
    ...normalizeBranchXResponse(rawPayload),
  };
}

export async function checkBranchXPayoutStatus(requestId: string) {
  const config = getBranchXConfig();
  if (!config.isConfigured) {
    throw new Error("BranchX payout configuration is incomplete");
  }

  const rawPayload = await postJson(config.statusUrl, { requestId });
  return normalizeBranchXResponse(rawPayload);
}
