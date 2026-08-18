import { and, desc, eq, gte, lt, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  leadActivities,
  leadNotes,
  leads,
  outreachDrafts,
  smtpSettings,
  senderProfiles,
  outreachPolicies,
  replyHubSettings,
  replyThreads,
  inboundMessages,
  suppressedRecipients,
  telegramSettings,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listLeads(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leads).where(eq(leads.userId, userId)).orderBy(desc(leads.updatedAt));
}

export async function listLeadsByContactEmail(userId: number, email: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leads).where(and(eq(leads.userId, userId), eq(leads.contactEmail, email.toLowerCase())));
}

export async function getLead(userId: number, leadId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(leads).where(and(eq(leads.id, leadId), eq(leads.userId, userId))).limit(1);
  return result[0];
}

export async function createLead(userId: number, values: Omit<typeof leads.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(leads).values({ ...values, userId });
  return Number(result[0].insertId);
}

export async function updateLead(userId: number, leadId: number, values: Partial<Omit<typeof leads.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(leads).set(values).where(and(eq(leads.id, leadId), eq(leads.userId, userId)));
}

export async function deleteLead(userId: number, leadId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(leadActivities).where(and(eq(leadActivities.leadId, leadId), eq(leadActivities.userId, userId)));
  await db.delete(leadNotes).where(and(eq(leadNotes.leadId, leadId), eq(leadNotes.userId, userId)));
  await db.delete(outreachDrafts).where(and(eq(outreachDrafts.leadId, leadId), eq(outreachDrafts.userId, userId)));
  await db.delete(leads).where(and(eq(leads.id, leadId), eq(leads.userId, userId)));
}

export async function addActivity(userId: number, leadId: number, type: typeof leadActivities.$inferInsert.type, detail?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(leadActivities).values({ userId, leadId, type, detail: detail ?? null });
}

export async function getLeadWorkspace(userId: number, leadId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [lead, notes, activities, drafts] = await Promise.all([
    getLead(userId, leadId),
    db.select().from(leadNotes).where(and(eq(leadNotes.leadId, leadId), eq(leadNotes.userId, userId))).orderBy(desc(leadNotes.createdAt)),
    db.select().from(leadActivities).where(and(eq(leadActivities.leadId, leadId), eq(leadActivities.userId, userId))).orderBy(desc(leadActivities.createdAt)),
    db.select().from(outreachDrafts).where(and(eq(outreachDrafts.leadId, leadId), eq(outreachDrafts.userId, userId))).orderBy(desc(outreachDrafts.updatedAt)),
  ]);
  return { lead, notes, activities, drafts };
}

export async function addNote(userId: number, leadId: number, body: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(leadNotes).values({ userId, leadId, body });
}

export async function createDraft(userId: number, leadId: number, subject: string, body: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(outreachDrafts).values({ userId, leadId, subject, body, status: "draft" });
  return Number(result[0].insertId);
}

export async function getDraft(userId: number, draftId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(outreachDrafts).where(and(eq(outreachDrafts.id, draftId), eq(outreachDrafts.userId, userId))).limit(1);
  return result[0];
}

export async function updateDraft(userId: number, draftId: number, values: Partial<Omit<typeof outreachDrafts.$inferInsert, "id" | "userId" | "leadId" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(outreachDrafts).set(values).where(and(eq(outreachDrafts.id, draftId), eq(outreachDrafts.userId, userId)));
}

export async function listDrafts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(outreachDrafts).where(eq(outreachDrafts.userId, userId)).orderBy(desc(outreachDrafts.updatedAt));
}

export async function getSmtpSettings(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(smtpSettings).where(eq(smtpSettings.userId, userId)).limit(1);
  return result[0];
}

export async function saveSmtpSettings(userId: number, values: Omit<typeof smtpSettings.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(smtpSettings).values({ ...values, userId }).onDuplicateKeyUpdate({ set: values });
}

export async function getTelegramSettings(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(telegramSettings).where(eq(telegramSettings.userId, userId)).limit(1);
  return result[0];
}

export async function saveTelegramSettings(userId: number, values: Omit<typeof telegramSettings.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(telegramSettings).values({ ...values, userId }).onDuplicateKeyUpdate({ set: values });
}

export async function getSenderProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(senderProfiles).where(eq(senderProfiles.userId, userId)).limit(1);
  return result[0];
}

export async function saveSenderProfile(userId: number, values: Omit<typeof senderProfiles.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(senderProfiles).values({ ...values, userId }).onDuplicateKeyUpdate({ set: values });
}

export async function getOutreachPolicy(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(outreachPolicies).where(eq(outreachPolicies.userId, userId)).limit(1);
  return result[0];
}

export async function saveOutreachPolicy(userId: number, dailyLimit: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(outreachPolicies).values({ userId, dailyLimit }).onDuplicateKeyUpdate({ set: { dailyLimit } });
}

export async function listSuppressedRecipients(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(suppressedRecipients).where(eq(suppressedRecipients.userId, userId)).orderBy(desc(suppressedRecipients.createdAt));
}

export async function getSuppressedRecipient(userId: number, email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(suppressedRecipients).where(and(eq(suppressedRecipients.userId, userId), eq(suppressedRecipients.email, email.toLowerCase()))).limit(1);
  return result[0];
}

export async function suppressRecipient(userId: number, email: string, reason: string, source: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const values = { userId, email: email.toLowerCase(), reason, source };
  await db.insert(suppressedRecipients).values(values).onDuplicateKeyUpdate({ set: { reason, source } });
}

export async function unsuppressRecipient(userId: number, email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(suppressedRecipients).where(and(eq(suppressedRecipients.userId, userId), eq(suppressedRecipients.email, email.toLowerCase())));
}

export async function countSentToday(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const result = await db.select({ value: count() }).from(outreachDrafts).where(and(eq(outreachDrafts.userId, userId), eq(outreachDrafts.status, "sent"), gte(outreachDrafts.sentAt, start), lt(outreachDrafts.sentAt, end)));
  return Number(result[0]?.value || 0);
}

export async function getReplyHubSettings(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(replyHubSettings).where(eq(replyHubSettings.userId, userId)).limit(1);
  return result[0];
}

export async function saveReplyHubSettings(userId: number, values: Omit<typeof replyHubSettings.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(replyHubSettings).values({ ...values, userId }).onDuplicateKeyUpdate({ set: values });
}

export async function listReplyThreads(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(replyThreads).where(eq(replyThreads.userId, userId)).orderBy(desc(replyThreads.lastReceivedAt));
}

export async function getReplyThread(userId: number, threadId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(replyThreads).where(and(eq(replyThreads.id, threadId), eq(replyThreads.userId, userId))).limit(1);
  return result[0];
}

export async function listInboundMessages(userId: number, threadId?: number) {
  const db = await getDb();
  if (!db) return [];
  const where = threadId ? and(eq(inboundMessages.userId, userId), eq(inboundMessages.threadId, threadId)) : eq(inboundMessages.userId, userId);
  return db.select().from(inboundMessages).where(where).orderBy(desc(inboundMessages.receivedAt));
}

export async function getInboundMessageByProviderId(userId: number, providerMessageId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(inboundMessages).where(and(eq(inboundMessages.userId, userId), eq(inboundMessages.providerMessageId, providerMessageId))).limit(1);
  return result[0];
}

export async function getInboundMessageByRawHash(userId: number, rawHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(inboundMessages).where(and(eq(inboundMessages.userId, userId), eq(inboundMessages.rawHash, rawHash))).limit(1);
  return result[0];
}

export async function upsertReplyThread(input: { userId: number; leadId: number | null; participantEmail: string; subject: string | null; classification: typeof replyThreads.$inferInsert.latestClassification; receivedAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db.select().from(replyThreads).where(and(eq(replyThreads.userId, input.userId), eq(replyThreads.participantEmail, input.participantEmail))).limit(1);
  if (existing[0]) {
    await db.update(replyThreads).set({ leadId: input.leadId, latestSubject: input.subject, latestClassification: input.classification, lastReceivedAt: input.receivedAt }).where(eq(replyThreads.id, existing[0].id));
    return existing[0].id;
  }
  const result = await db.insert(replyThreads).values({ userId: input.userId, leadId: input.leadId, participantEmail: input.participantEmail, latestSubject: input.subject, latestClassification: input.classification, lastReceivedAt: input.receivedAt });
  return Number(result[0].insertId);
}

export async function createInboundMessage(input: Omit<typeof inboundMessages.$inferInsert, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(inboundMessages).values(input);
  return Number(result[0].insertId);
}

export async function saveReplyThreadDraft(userId: number, threadId: number, responseDraft: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(replyThreads).set({ responseDraft, responseDraftUpdatedAt: new Date() }).where(and(eq(replyThreads.id, threadId), eq(replyThreads.userId, userId)));
}
