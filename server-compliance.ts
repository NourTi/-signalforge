import { createHmac, timingSafeEqual } from "node:crypto";

export function createUnsubscribeSignature(userId: number, email: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`${userId}:${email.toLowerCase()}`)
    .digest("base64url");
}

export function validUnsubscribeSignature(userId: number, email: string, signature: string, secret: string) {
  const received = Buffer.from(signature);
  const expected = Buffer.from(createUnsubscribeSignature(userId, email, secret));
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function outboundQuota({ sentToday, dailyLimit }: { sentToday: number; dailyLimit: number }) {
  return {
    sentToday,
    dailyLimit,
    remaining: Math.max(0, dailyLimit - sentToday),
    allowed: sentToday < dailyLimit,
  };
}

export function outboundBlockReason(input: {
  profileConfigured?: boolean;
  recipientSuppressed?: boolean;
  quotaAllowed?: boolean;
  senderReady?: boolean;
}) {
  if (input.recipientSuppressed) return "Recipient is suppressed.";
  if (input.profileConfigured === false) return "Commercial sender profile is required.";
  if (input.quotaAllowed === false) return "Daily send limit reached.";
  if (input.senderReady === false) return "Sender-domain readiness is incomplete.";
  return null;
}
