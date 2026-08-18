import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type InboundClassification = "reply" | "opt_out" | "bounce" | "out_of_office" | "unknown";

export type InboundReplyPayload = {
  workspaceId: number;
  messageId: string;
  from: string;
  to: string;
  subject?: string;
  text?: string;
  receivedAt?: string;
};

export function normalizeReplyAddress(value: string) {
  return value.trim().toLowerCase();
}

export function createReplyHubSigningSecret() {
  return randomBytes(32).toString("base64url");
}

export function signReplyHubPayload(rawBody: string, secret: string) {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

export function verifyReplyHubSignature(rawBody: string, suppliedSignature: string | undefined, secret: string) {
  if (!suppliedSignature) return false;
  const expected = Buffer.from(signReplyHubPayload(rawBody, secret));
  const received = Buffer.from(suppliedSignature.trim());
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function inboundMessageHash(input: Pick<InboundReplyPayload, "messageId" | "from" | "to" | "subject" | "text">) {
  return createHash("sha256").update([input.messageId, normalizeReplyAddress(input.from), normalizeReplyAddress(input.to), input.subject || "", input.text || ""].join("\n"), "utf8").digest("hex");
}

export function classifyInboundMessage(input: Pick<InboundReplyPayload, "from" | "subject" | "text">): InboundClassification {
  const subject = (input.subject || "").toLowerCase();
  const text = (input.text || "").toLowerCase();
  const joined = `${subject}\n${text}`;
  if (/unsubscribe|remove me|opt[ -]?out|stop emailing|do not contact/.test(joined)) return "opt_out";
  if (/delivery status notification|undeliverable|mailbox unavailable|address not found|permanent failure/.test(joined)) return "bounce";
  if (/out of office|automatic reply|auto-reply|away from the office/.test(joined)) return "out_of_office";
  return input.from.includes("@") ? "reply" : "unknown";
}

export function parseInboundTimestamp(value?: string) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
