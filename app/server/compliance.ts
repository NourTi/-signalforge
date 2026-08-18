import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveTxt } from "node:dns/promises";

function signingKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Unsubscribe signing is unavailable.");
  return secret;
}

export function createUnsubscribeSignature(userId: number, email: string) {
  return createHmac("sha256", signingKey()).update(`${userId}:${email.toLowerCase()}`).digest("base64url");
}

export function validUnsubscribeSignature(userId: number, email: string, signature: string) {
  const expected = createUnsubscribeSignature(userId, email);
  const received = Buffer.from(signature);
  const known = Buffer.from(expected);
  return received.length === known.length && timingSafeEqual(received, known);
}

export function unsubscribeUrl(baseUrl: string, userId: number, email: string) {
  const query = new URLSearchParams({ u: String(userId), e: email, s: createUnsubscribeSignature(userId, email) });
  return `${baseUrl.replace(/\/$/, "")}/unsubscribe?${query.toString()}`;
}

async function txtRecords(hostname: string) {
  try { return (await resolveTxt(hostname)).map(record => record.join("")); } catch { return []; }
}

export async function checkSenderDomain(domain: string, dkimSelector?: string | null) {
  const cleanDomain = domain.trim().toLowerCase().replace(/^@/, "");
  if (!cleanDomain || !cleanDomain.includes(".")) throw new Error("Use a valid sender domain.");
  const [root, dmarc, dkim] = await Promise.all([
    txtRecords(cleanDomain),
    txtRecords(`_dmarc.${cleanDomain}`),
    dkimSelector ? txtRecords(`${dkimSelector.trim()}._domainkey.${cleanDomain}`) : Promise.resolve([]),
  ]);
  const spfReady = root.some(value => /v=spf1/i.test(value));
  const dmarcReady = dmarc.some(value => /v=dmarc1/i.test(value));
  const dkimReady = Boolean(dkimSelector?.trim()) && dkim.some(value => /v=dkim1|p=/i.test(value));
  return { domain: cleanDomain, spfReady, dmarcReady, dkimReady, dkimSelector: dkimSelector?.trim() || null, ready: spfReady && dmarcReady && dkimReady, checkedAt: new Date() };
}

export function composeComplianceFooter(input: { legalBusinessName: string; postalAddress: string; optOutText: string; unsubscribeUrl: string }) {
  return `\n\n--\n${input.legalBusinessName}\n${input.postalAddress}\n\n${input.optOutText}\nUnsubscribe: ${input.unsubscribeUrl}`;
}

export function outboundQuota({ sentToday, dailyLimit }: { sentToday: number; dailyLimit: number }) {
  return { sentToday, dailyLimit, remaining: Math.max(0, dailyLimit - sentToday), allowed: sentToday < dailyLimit };
}

export function outboundBlockReason(input: { profileConfigured?: boolean; recipientSuppressed?: boolean; quotaAllowed?: boolean; senderReady?: boolean }) {
  if (input.recipientSuppressed) return "Recipient is suppressed.";
  if (input.profileConfigured === false) return "Commercial sender profile is required.";
  if (input.quotaAllowed === false) return "Daily send limit reached.";
  if (input.senderReady === false) return "Sender-domain readiness is incomplete.";
  return null;
}
