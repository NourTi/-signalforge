import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  addActivity, addNote, countSentToday, createDraft, createLead, deleteLead, getDraft, getLead, getLeadWorkspace,
  getOutreachPolicy, getSenderProfile, getSmtpSettings, getSuppressedRecipient, getTelegramSettings, listDrafts, listLeads, listSuppressedRecipients,
  getReplyHubSettings, getReplyThread, listInboundMessages, listReplyThreads, saveReplyHubSettings, saveReplyThreadDraft, saveOutreachPolicy, saveSenderProfile, saveSmtpSettings, saveTelegramSettings, suppressRecipient, unsuppressRecipient, updateDraft, updateLead,
} from "./db";
import { dispatchApprovedEmail } from "./email";
import { toSafeLeadExport } from "./leadExport";
import { decryptSecret, encryptSecret } from "./secretCrypto";
import { findPublicBusinesses, hasDiscoveryDuplicate } from "./discovery";
import { sendTelegramAlert, shouldDeliverDiscoverySaveAlert } from "./telegram";
import { checkSenderDomain, composeComplianceFooter, outboundBlockReason, outboundQuota, unsubscribeUrl } from "./compliance";
import { createReplyHubSigningSecret } from "./replyHub";

const optionalUrl = z.string().trim().max(2048).optional().or(z.literal(""));
const optionalEmail = z.string().trim().email().max(320).optional().or(z.literal(""));
const leadInput = z.object({
  companyName: z.string().trim().min(1).max(255),
  website: optionalUrl,
  industry: z.string().trim().max(255).optional().or(z.literal("")),
  country: z.string().trim().max(120).optional().or(z.literal("")),
  contactEmail: optionalEmail,
  status: z.enum(["new", "reviewed", "contacted", "replied"]).default("new"),
});
const nullable = (value?: string) => value?.trim() || null;
const discoveryInput = z.object({
  keyword: z.string().trim().min(2).max(120),
  industry: z.string().trim().max(120).optional().or(z.literal("")),
  businessType: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  country: z.string().trim().max(120).optional().or(z.literal("")),
  mode: z.enum(["quick", "contact"]).default("quick"),
  maxResults: z.number().int().min(1).max(10).default(5),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  lead: router({
    list: protectedProcedure.query(({ ctx }) => listLeads(ctx.user.id)),
    get: protectedProcedure.input(z.object({ leadId: z.number().int().positive() })).query(({ ctx, input }) => getLeadWorkspace(ctx.user.id, input.leadId)),
    create: protectedProcedure.input(leadInput).mutation(async ({ ctx, input }) => {
      const leadId = await createLead(ctx.user.id, { ...input, website: nullable(input.website), industry: nullable(input.industry), country: nullable(input.country), contactEmail: nullable(input.contactEmail) });
      await addActivity(ctx.user.id, leadId, "lead_created", "Lead added manually");
      return { leadId };
    }),
    update: protectedProcedure.input(z.object({ leadId: z.number().int().positive(), values: leadInput })).mutation(async ({ ctx, input }) => {
      const existing = await getLead(ctx.user.id, input.leadId);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await updateLead(ctx.user.id, input.leadId, { ...input.values, website: nullable(input.values.website), industry: nullable(input.values.industry), country: nullable(input.values.country), contactEmail: nullable(input.values.contactEmail) });
      if (existing.status !== input.values.status && input.values.status === "replied") await addActivity(ctx.user.id, input.leadId, "reply_logged", "Reply recorded and pipeline stage updated");
      else if (existing.status !== input.values.status) await addActivity(ctx.user.id, input.leadId, "status_changed", `Stage changed from ${existing.status} to ${input.values.status}`);
      else await addActivity(ctx.user.id, input.leadId, "lead_updated", "Lead details updated");
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ leadId: z.number().int().positive(), confirmation: z.literal(true) })).mutation(async ({ ctx, input }) => {
      if (!await getLead(ctx.user.id, input.leadId)) throw new TRPCError({ code: "NOT_FOUND" });
      await deleteLead(ctx.user.id, input.leadId);
      return { success: true };
    }),
    addNote: protectedProcedure.input(z.object({ leadId: z.number().int().positive(), body: z.string().trim().min(1).max(5000) })).mutation(async ({ ctx, input }) => {
      if (!await getLead(ctx.user.id, input.leadId)) throw new TRPCError({ code: "NOT_FOUND" });
      await addNote(ctx.user.id, input.leadId, input.body);
      await addActivity(ctx.user.id, input.leadId, "note_added", "Note added");
      return { success: true };
    }),
    export: protectedProcedure.query(async ({ ctx }) => (await listLeads(ctx.user.id)).map(toSafeLeadExport)),
    analytics: protectedProcedure.query(async ({ ctx }) => {
      const [leadRows, draftRows] = await Promise.all([listLeads(ctx.user.id), listDrafts(ctx.user.id)]);
      const sent = draftRows.filter(draft => draft.status === "sent").length;
      const replied = leadRows.filter(lead => lead.status === "replied").length;
      return { total: leadRows.length, sent, replies: replied, replyRate: sent ? Math.round((replied / sent) * 1000) / 10 : 0, stages: ["new", "reviewed", "contacted", "replied"].map(status => ({ status, count: leadRows.filter(lead => lead.status === status).length })) };
    }),
  }),
  discovery: router({
    search: protectedProcedure.input(discoveryInput).mutation(({ input }) => findPublicBusinesses({ ...input, industry: nullable(input.industry) || undefined, businessType: nullable(input.businessType) || undefined, city: nullable(input.city) || undefined, country: nullable(input.country) || undefined })),
    save: protectedProcedure.input(z.object({
      companyName: z.string().trim().min(1).max(255), website: optionalUrl, industry: z.string().trim().max(255).optional().or(z.literal("")), country: z.string().trim().max(120).optional().or(z.literal("")), contactEmail: optionalEmail,
      sourceUrl: optionalUrl, sourcePlaceId: z.string().trim().max(255).optional().or(z.literal("")), emailSourceUrl: optionalUrl, emailConfidence: z.enum(["mailto", "visible"]).optional().nullable(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await listLeads(ctx.user.id);
      const duplicate = existing.find(lead => hasDiscoveryDuplicate([lead], { sourcePlaceId: input.sourcePlaceId || undefined, website: nullable(input.website), contactEmail: nullable(input.contactEmail) }));
      if (duplicate) return { leadId: duplicate.id, duplicate: true, telegramAlerted: false };
      const leadId = await createLead(ctx.user.id, {
        companyName: input.companyName, website: nullable(input.website), industry: nullable(input.industry), country: nullable(input.country), contactEmail: nullable(input.contactEmail), status: "new",
        discoverySource: "google_places_official_website", sourceUrl: nullable(input.sourceUrl), sourcePlaceId: nullable(input.sourcePlaceId), emailSourceUrl: nullable(input.emailSourceUrl), emailConfidence: input.emailConfidence || null,
      });
      await addActivity(ctx.user.id, leadId, "discovery_saved", "Business saved from public discovery after user review");
      const telegram = await getTelegramSettings(ctx.user.id);
      let telegramAlerted = false;
      if (telegram && shouldDeliverDiscoverySaveAlert({ enabled: telegram.enabled, explicitSave: true })) {
        try {
          await sendTelegramAlert({ token: decryptSecret(telegram.encryptedBotToken), chatId: telegram.chatId, text: `SignalForge: saved ${input.companyName}${input.contactEmail ? ` · ${input.contactEmail}` : ""}` });
          await addActivity(ctx.user.id, leadId, "telegram_alerted", "User-configured Telegram save alert delivered");
          telegramAlerted = true;
        } catch { /* Optional alerts cannot block a user-approved lead save. */ }
      }
      return { leadId, duplicate: false, telegramAlerted };
    }),
  }),
  outreach: router({
    list: protectedProcedure.query(({ ctx }) => listDrafts(ctx.user.id)),
    generate: protectedProcedure.input(z.object({ leadId: z.number().int().positive(), offer: z.string().trim().min(8).max(1200), tone: z.enum(["direct", "consultative", "warm"]).default("consultative") })).mutation(async ({ ctx, input }) => {
      const lead = await getLead(ctx.user.id, input.leadId);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
      if (!lead.contactEmail) throw new TRPCError({ code: "BAD_REQUEST", message: "Add a contact email before drafting outreach." });
      const draftBlock = outboundBlockReason({ recipientSuppressed: Boolean(await getSuppressedRecipient(ctx.user.id, lead.contactEmail)) });
      if (draftBlock) throw new TRPCError({ code: "BAD_REQUEST", message: draftBlock });
      const models = await listLLMModels(); const model = models.data.find(item => item.id === "gpt-5-mini")?.id ?? models.data[0]?.id;
      if (!model) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No drafting model is available." });
      const response = await invokeLLM({ model, messages: [{ role: "system", content: "You write concise, respectful B2B outreach. Return only valid JSON with subject and body. Never invent facts about the recipient, do not make unverifiable performance claims, avoid pressure, and include a low-friction opt-out sentence. The email must be ready for a human to review and edit." }, { role: "user", content: JSON.stringify({ company: lead.companyName, website: lead.website, industry: lead.industry, country: lead.country, recipientEmail: lead.contactEmail, senderOffer: input.offer, tone: input.tone, schema: { subject: "string, 3 to 8 words", body: "string, 70 to 150 words" } }) }], response_format: { type: "json_schema", json_schema: { name: "outreach_draft", strict: true, schema: { type: "object", properties: { subject: { type: "string" }, body: { type: "string" } }, required: ["subject", "body"], additionalProperties: false } } } });
      const content = response.choices[0]?.message?.content;
      if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Draft generation returned no content." });
      const draft = JSON.parse(content) as { subject: string; body: string };
      const draftId = await createDraft(ctx.user.id, lead.id, draft.subject.trim().slice(0, 500), draft.body.trim());
      await addActivity(ctx.user.id, lead.id, "draft_generated", "AI outreach draft created for review");
      return { draftId };
    }),
    update: protectedProcedure.input(z.object({ draftId: z.number().int().positive(), subject: z.string().trim().min(1).max(500), body: z.string().trim().min(1).max(10000) })).mutation(async ({ ctx, input }) => {
      const draft = await getDraft(ctx.user.id, input.draftId); if (!draft || draft.status === "sent") throw new TRPCError({ code: "BAD_REQUEST", message: "This sent draft cannot be edited." });
      await updateDraft(ctx.user.id, input.draftId, { subject: input.subject, body: input.body, status: "draft", approvedAt: null }); await addActivity(ctx.user.id, draft.leadId, "draft_updated", "Outreach draft edited and returned to draft"); return { success: true };
    }),
    approve: protectedProcedure.input(z.object({ draftId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const draft = await getDraft(ctx.user.id, input.draftId); if (!draft || draft.status === "sent") throw new TRPCError({ code: "BAD_REQUEST", message: "This draft is unavailable for approval." }); const [lead, profile] = await Promise.all([getLead(ctx.user.id, draft.leadId), getSenderProfile(ctx.user.id)]); const block = outboundBlockReason({ profileConfigured: Boolean(profile), recipientSuppressed: Boolean(lead?.contactEmail && await getSuppressedRecipient(ctx.user.id, lead.contactEmail)) }); if (block) { await addActivity(ctx.user.id, draft.leadId, "send_blocked", `Approval blocked: ${block}`); throw new TRPCError({ code: "PRECONDITION_FAILED", message: block }); } await updateDraft(ctx.user.id, input.draftId, { status: "approved", approvedAt: new Date(), failureReason: null }); await addActivity(ctx.user.id, draft.leadId, "draft_approved", "Draft approved; explicit send confirmation still required"); return { success: true }; }),
    reject: protectedProcedure.input(z.object({ draftId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const draft = await getDraft(ctx.user.id, input.draftId); if (!draft || draft.status === "sent") throw new TRPCError({ code: "BAD_REQUEST" }); await updateDraft(ctx.user.id, input.draftId, { status: "rejected" }); await addActivity(ctx.user.id, draft.leadId, "draft_rejected", "Draft rejected"); return { success: true }; }),
    send: protectedProcedure.input(z.object({ draftId: z.number().int().positive(), confirmation: z.literal(true) })).mutation(async ({ ctx, input }) => {
      const draft = await getDraft(ctx.user.id, input.draftId); if (!draft || draft.status !== "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "Only an approved draft may be sent after confirmation." });
      const [lead, smtp, profile, policy] = await Promise.all([getLead(ctx.user.id, draft.leadId), getSmtpSettings(ctx.user.id), getSenderProfile(ctx.user.id), getOutreachPolicy(ctx.user.id)]);
      if (!lead?.contactEmail) throw new TRPCError({ code: "BAD_REQUEST", message: "This lead has no contact email." });
      if (!smtp) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configure SMTP before sending." });
      if (!profile) { await addActivity(ctx.user.id, lead.id, "send_blocked", "Send blocked: commercial sender profile is missing"); throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Commercial sender profile is required." }); }
      const suppressed = await getSuppressedRecipient(ctx.user.id, lead.contactEmail);
      const quota = outboundQuota({ sentToday: await countSentToday(ctx.user.id), dailyLimit: policy?.dailyLimit ?? 15 });
      const domain = smtp.fromEmail.split("@")[1]; const readiness = await checkSenderDomain(domain || "", profile.dkimSelector);
      const sendBlock = outboundBlockReason({ profileConfigured: Boolean(profile), recipientSuppressed: Boolean(suppressed), quotaAllowed: quota.allowed, senderReady: readiness.ready });
      if (sendBlock) { await addActivity(ctx.user.id, lead.id, "send_blocked", `Send blocked: ${sendBlock}`); throw new TRPCError({ code: "PRECONDITION_FAILED", message: sendBlock }); }
      const baseUrl = process.env.APP_URL || `${ctx.req.protocol}://${ctx.req.get("host")}`;
      const footer = composeComplianceFooter({ legalBusinessName: profile.legalBusinessName, postalAddress: profile.postalAddress, optOutText: profile.optOutText, unsubscribeUrl: unsubscribeUrl(baseUrl, ctx.user.id, lead.contactEmail) });
      try { await dispatchApprovedEmail({ ...smtp, password: decryptSecret(smtp.encryptedPassword), replyToEmail: profile.replyToEmail, complianceFooter: footer, to: lead.contactEmail, subject: draft.subject, body: draft.body }); await updateDraft(ctx.user.id, draft.id, { status: "sent", sentAt: new Date(), failureReason: null }); await updateLead(ctx.user.id, lead.id, { status: lead.status === "replied" ? "replied" : "contacted" }); await addActivity(ctx.user.id, lead.id, "email_sent", `Approved email dispatched after explicit confirmation. ${quota.remaining - 1} sends remain today.`); return { success: true, remaining: quota.remaining - 1 }; }
      catch { await updateDraft(ctx.user.id, draft.id, { failureReason: "SMTP dispatch failed. Check your SMTP settings and try again." }); await addActivity(ctx.user.id, draft.leadId, "email_failed", "Approved send attempt failed"); throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "SMTP dispatch failed. Review your settings and retry." }); }
    }),
  }),
  smtp: router({
    status: protectedProcedure.query(async ({ ctx }) => { const settings = await getSmtpSettings(ctx.user.id); return settings ? { configured: true, host: settings.host, port: settings.port, secure: settings.secure, username: settings.username, fromName: settings.fromName, fromEmail: settings.fromEmail } : { configured: false }; }),
    save: protectedProcedure.input(z.object({ host: z.string().trim().min(1).max(255), port: z.number().int().min(1).max(65535), secure: z.boolean(), username: z.string().trim().min(1).max(320), password: z.string().min(1).max(1000).optional(), fromName: z.string().trim().max(255).optional().or(z.literal("")), fromEmail: z.string().trim().email().max(320) })).mutation(async ({ ctx, input }) => { const existing = await getSmtpSettings(ctx.user.id); if (!existing && !input.password) throw new TRPCError({ code: "BAD_REQUEST", message: "An SMTP password is required for the first setup." }); await saveSmtpSettings(ctx.user.id, { host: input.host, port: input.port, secure: input.secure, username: input.username, encryptedPassword: input.password ? encryptSecret(input.password) : existing!.encryptedPassword, fromName: nullable(input.fromName), fromEmail: input.fromEmail }); return { success: true }; }),
  }),
  compliance: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const [profile, smtp, policy, sentToday, suppressed, drafts] = await Promise.all([getSenderProfile(ctx.user.id), getSmtpSettings(ctx.user.id), getOutreachPolicy(ctx.user.id), countSentToday(ctx.user.id), listSuppressedRecipients(ctx.user.id), listDrafts(ctx.user.id)]);
      const readiness = profile && smtp ? await checkSenderDomain(smtp.fromEmail.split("@")[1] || "", profile.dkimSelector) : null;
      const quota = outboundQuota({ sentToday, dailyLimit: policy?.dailyLimit ?? 15 });
      const recentFailures = drafts.filter(item => item.status === "draft" && item.failureReason).slice(0, 5).map(item => ({ id: item.id, reason: item.failureReason, updatedAt: item.updatedAt }));
      return { profile: profile ? { legalBusinessName: profile.legalBusinessName, postalAddress: profile.postalAddress, replyToEmail: profile.replyToEmail, optOutText: profile.optOutText, dkimSelector: profile.dkimSelector } : null, smtpConfigured: Boolean(smtp), smtpStatus: smtp ? { host: smtp.host, port: smtp.port, secure: smtp.secure, fromEmail: smtp.fromEmail } : null, readiness, quota, suppressedCount: suppressed.length, recentFailures, sendEnabled: Boolean(profile && smtp && readiness?.ready && quota.allowed) };
    }),
    saveProfile: protectedProcedure.input(z.object({ legalBusinessName: z.string().trim().min(2).max(255), postalAddress: z.string().trim().min(10).max(2000), replyToEmail: z.string().trim().email().max(320), optOutText: z.string().trim().min(10).max(500), dkimSelector: z.string().trim().max(255).optional().or(z.literal("")) })).mutation(async ({ ctx, input }) => { await saveSenderProfile(ctx.user.id, { ...input, dkimSelector: nullable(input.dkimSelector) }); return { success: true }; }),
    savePolicy: protectedProcedure.input(z.object({ dailyLimit: z.number().int().min(1).max(100) })).mutation(async ({ ctx, input }) => { await saveOutreachPolicy(ctx.user.id, input.dailyLimit); return { success: true }; }),
    checkDomain: protectedProcedure.query(async ({ ctx }) => { const [profile, smtp] = await Promise.all([getSenderProfile(ctx.user.id), getSmtpSettings(ctx.user.id)]); if (!smtp) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configure SMTP before checking the sender domain." }); return checkSenderDomain(smtp.fromEmail.split("@")[1] || "", profile?.dkimSelector); }),
    listSuppressed: protectedProcedure.query(({ ctx }) => listSuppressedRecipients(ctx.user.id)),
    suppress: protectedProcedure.input(z.object({ email: z.string().trim().email().max(320), reason: z.string().trim().min(2).max(500), source: z.enum(["manual", "opt_out"]).default("manual"), leadId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => { await suppressRecipient(ctx.user.id, input.email, input.reason, input.source); if (input.leadId) await addActivity(ctx.user.id, input.leadId, input.source === "opt_out" ? "opt_out_received" : "recipient_suppressed", `Recipient suppressed: ${input.reason}`); return { success: true }; }),
    unsuppress: protectedProcedure.input(z.object({ email: z.string().trim().email().max(320), leadId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => { await unsuppressRecipient(ctx.user.id, input.email); if (input.leadId) await addActivity(ctx.user.id, input.leadId, "recipient_unsuppressed", "Recipient suppression removed manually"); return { success: true }; }),
  }),
  telegram: router({
    status: protectedProcedure.query(async ({ ctx }) => { const settings = await getTelegramSettings(ctx.user.id); return settings ? { configured: true, chatId: settings.chatId, enabled: settings.enabled } : { configured: false, enabled: false }; }),
    save: protectedProcedure.input(z.object({ chatId: z.string().trim().min(1).max(255), botToken: z.string().trim().min(20).max(512).optional(), enabled: z.boolean() })).mutation(async ({ ctx, input }) => { const existing = await getTelegramSettings(ctx.user.id); if (!existing && !input.botToken) throw new TRPCError({ code: "BAD_REQUEST", message: "A bot token is required for initial Telegram setup." }); await saveTelegramSettings(ctx.user.id, { chatId: input.chatId, enabled: input.enabled, encryptedBotToken: input.botToken ? encryptSecret(input.botToken) : existing!.encryptedBotToken }); return { success: true }; }),
    test: protectedProcedure.input(z.object({ confirmation: z.literal(true) })).mutation(async ({ ctx }) => { const settings = await getTelegramSettings(ctx.user.id); if (!settings) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configure Telegram before testing alerts." }); try { await sendTelegramAlert({ token: decryptSecret(settings.encryptedBotToken), chatId: settings.chatId, text: "SignalForge: Telegram alerts are connected. Discovery-save alerts are now available when enabled." }); return { success: true }; } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Telegram could not deliver this test. Check the bot token, chat ID, and that the bot can message this chat." }); } }),
  }),
  replyHub: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const settings = await getReplyHubSettings(ctx.user.id);
      const endpoint = `${ctx.req.protocol}://${ctx.req.get("host")}/api/reply-hub/inbound`;
      return settings ? { configured: true, inboundAddress: settings.inboundAddress, enabled: settings.enabled, workspaceId: ctx.user.id, endpoint } : { configured: false, enabled: false, inboundAddress: null, workspaceId: ctx.user.id, endpoint };
    }),
    list: protectedProcedure.query(async ({ ctx }) => {
      const [threads, messages] = await Promise.all([listReplyThreads(ctx.user.id), listInboundMessages(ctx.user.id)]);
      return { threads, messages };
    }),
    saveSettings: protectedProcedure.input(z.object({ inboundAddress: z.string().trim().email().max(320), enabled: z.boolean(), rotateSecret: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
      const existing = await getReplyHubSettings(ctx.user.id);
      const shouldRevealSecret = !existing || input.rotateSecret;
      const secret = shouldRevealSecret ? createReplyHubSigningSecret() : decryptSecret(existing.encryptedSigningSecret);
      await saveReplyHubSettings(ctx.user.id, { inboundAddress: input.inboundAddress.toLowerCase(), enabled: input.enabled, encryptedSigningSecret: shouldRevealSecret ? encryptSecret(secret) : existing.encryptedSigningSecret });
      return { success: true, secret: shouldRevealSecret ? secret : null };
    }),
    saveResponseDraft: protectedProcedure.input(z.object({ threadId: z.number().int().positive(), body: z.string().trim().min(1).max(10000) })).mutation(async ({ ctx, input }) => {
      if (!await getReplyThread(ctx.user.id, input.threadId)) throw new TRPCError({ code: "NOT_FOUND", message: "Reply thread not found." });
      await saveReplyThreadDraft(ctx.user.id, input.threadId, input.body);
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
