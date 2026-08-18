import type { Express, Request } from "express";
import { z } from "zod";
import { addActivity, createInboundMessage, getInboundMessageByProviderId, getInboundMessageByRawHash, getReplyHubSettings, listLeadsByContactEmail, suppressRecipient, updateLead, upsertReplyThread } from "./db";
import { decryptSecret } from "./secretCrypto";
import { classifyInboundMessage, inboundMessageHash, normalizeReplyAddress, parseInboundTimestamp, verifyReplyHubSignature } from "./replyHub";

type RawRequest = Request & { rawBody?: string };

const inboundPayload = z.object({
  workspaceId: z.number().int().positive(),
  messageId: z.string().trim().min(1).max(512),
  from: z.string().trim().email().max(320),
  to: z.string().trim().email().max(320),
  subject: z.string().trim().max(500).optional(),
  text: z.string().max(10000).optional(),
  receivedAt: z.string().datetime().optional(),
});

type ReplyHubPersistence = {
  getSettings: typeof getReplyHubSettings;
  getByProviderId: typeof getInboundMessageByProviderId;
  getByRawHash: typeof getInboundMessageByRawHash;
  findLeadsByEmail: typeof listLeadsByContactEmail;
  upsertThread: typeof upsertReplyThread;
  createMessage: typeof createInboundMessage;
  suppress: typeof suppressRecipient;
  addActivity: typeof addActivity;
  updateLead: typeof updateLead;
};

const persistence: ReplyHubPersistence = {
  getSettings: getReplyHubSettings,
  getByProviderId: getInboundMessageByProviderId,
  getByRawHash: getInboundMessageByRawHash,
  findLeadsByEmail: listLeadsByContactEmail,
  upsertThread: upsertReplyThread,
  createMessage: createInboundMessage,
  suppress: suppressRecipient,
  addActivity,
  updateLead,
};

export async function ingestSignedInboundReply(rawBody: string, suppliedSignature: string | undefined, payload: unknown, store: ReplyHubPersistence = persistence) {
  const parsed = inboundPayload.safeParse(payload);
  if (!parsed.success) return { status: 400, body: { error: "Invalid inbound payload" } };
  const input = parsed.data;
  const settings = await store.getSettings(input.workspaceId);
  if (!settings?.enabled) return { status: 403, body: { error: "Reply Hub is not enabled for this workspace" } };
  if (normalizeReplyAddress(settings.inboundAddress) !== normalizeReplyAddress(input.to)) return { status: 403, body: { error: "Inbound address does not match this workspace" } };
  if (!verifyReplyHubSignature(rawBody, suppliedSignature, decryptSecret(settings.encryptedSigningSecret))) return { status: 401, body: { error: "Invalid inbound signature" } };

  const rawHash = inboundMessageHash(input);
  const duplicate = await store.getByProviderId(input.workspaceId, input.messageId) || await store.getByRawHash(input.workspaceId, rawHash);
  if (duplicate) return { status: 200, body: { accepted: true, duplicate: true } };

  const classification = classifyInboundMessage(input);
  const sender = normalizeReplyAddress(input.from);
  const lead = (await store.findLeadsByEmail(input.workspaceId, sender))[0];
  const receivedAt = parseInboundTimestamp(input.receivedAt);
  const threadId = await store.upsertThread({ userId: input.workspaceId, leadId: lead?.id ?? null, participantEmail: sender, subject: input.subject?.trim() || null, classification, receivedAt });
  const messageId = await store.createMessage({ userId: input.workspaceId, threadId, leadId: lead?.id ?? null, providerMessageId: input.messageId, rawHash, fromEmail: sender, toEmail: normalizeReplyAddress(input.to), subject: input.subject?.trim() || null, body: input.text?.trim().slice(0, 10000) || null, classification, quarantined: classification === "unknown", receivedAt });

  if (lead) {
    if (classification === "opt_out") {
      await store.suppress(input.workspaceId, sender, "Recipient requested opt-out through Reply Hub", "inbound_reply");
      await store.addActivity(input.workspaceId, lead.id, "opt_out_received", "Inbound Reply Hub classified an opt-out request and suppressed the recipient.");
    } else if (classification === "bounce") {
      await store.addActivity(input.workspaceId, lead.id, "inbound_bounce_received", "Inbound Reply Hub classified a delivery failure. Review the contact address before further outreach.");
    } else if (classification === "out_of_office") {
      await store.addActivity(input.workspaceId, lead.id, "inbound_out_of_office_received", "Inbound Reply Hub classified an out-of-office response. No response was sent.");
    } else if (classification === "reply") {
      await store.updateLead(input.workspaceId, lead.id, { status: "replied" });
      await store.addActivity(input.workspaceId, lead.id, "reply_logged", "Inbound reply captured by Reply Hub. No response was sent automatically.");
    }
  }
  return { status: 201, body: { accepted: true, duplicate: false, messageId, threadId, classification, leadId: lead?.id ?? null } };
}

export function registerReplyHubRoute(app: Express) {
  app.post("/api/reply-hub/inbound", async (req, res) => {
    const rawBody = (req as RawRequest).rawBody;
    if (!rawBody) return res.status(400).json({ error: "Raw payload unavailable" });
    const result = await ingestSignedInboundReply(rawBody, req.header("x-signalforge-signature"), req.body);
    return res.status(result.status).json(result.body);
  });
}
