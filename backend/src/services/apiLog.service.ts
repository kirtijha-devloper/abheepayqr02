import { prisma } from "../prisma";

export interface LogApiInteractionInput {
  transactionId?: string;
  refId?: string;
  service: string;
  action: string;
  type?: "outgoing" | "incoming";
  method?: string;
  url?: string;
  requestPayload?: any;
  responsePayload?: any;
  status?: string;
  statusCode?: number;
  ipAddress?: string;
  userAgent?: string;
}

export async function logApiInteraction(input: LogApiInteractionInput) {
  try {
    return await prisma.apiInteractionLog.create({
      data: {
        transactionId: input.transactionId,
        refId: input.refId,
        service: input.service,
        action: input.action,
        type: input.type || "outgoing",
        method: input.method,
        url: input.url,
        requestPayload: input.requestPayload || {},
        responsePayload: input.responsePayload || {},
        status: input.status,
        statusCode: input.statusCode,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to log API interaction:", error);
    // We don't throw here to avoid breaking the main flow if logging fails
    return null;
  }
}
