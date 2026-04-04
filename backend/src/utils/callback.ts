import { prisma } from "../index";

export async function triggerTransactionCallback(transactionId: string) {
  try {
    const txn = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { user: { include: { profile: true } } }
    });

    if (!txn || !txn.user.profile?.callbackUrl) {
      return;
    }

    const callbackUrl = txn.user.profile.callbackUrl;
    const payload = {
      id: txn.id,
      userId: txn.userId,
      serviceType: txn.serviceType,
      amount: txn.amount,
      status: txn.status,
      refId: txn.refId,
      clientRefId: txn.clientRefId,
      createdAt: txn.createdAt,
      type: txn.type,
      description: txn.description,
      beneficiary: txn.beneficiary,
      sender: txn.sender
    };

    // Create a pending log entry
    const log = await prisma.transactionCallbackLog.create({
      data: {
        transactionId: txn.id,
        url: callbackUrl,
        payload: payload as any,
        status: "pending"
      }
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const responseText = await response.text();
      
      await prisma.transactionCallbackLog.update({
        where: { id: log.id },
        data: {
          status: response.ok ? "success" : "failed",
          statusCode: response.status,
          response: responseText.slice(0, 1000) // Limit response log
        }
      });
    } catch (err: any) {
      console.error(`[Callback] Error for ${transactionId}:`, err.message);
      await prisma.transactionCallbackLog.update({
        where: { id: log.id },
        data: {
          status: "failed",
          response: err.message
        }
      });
    }
  } catch (error: any) {
    console.error(`[Callback Utility Error]:`, error.message);
  }
}
