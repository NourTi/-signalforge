import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "user"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const leadStatus = mysqlEnum("leadStatus", ["new", "reviewed", "contacted", "replied"]);
export const draftStatus = mysqlEnum("draftStatus", ["draft", "approved", "rejected", "sent"]);
export const activityType = mysqlEnum("activityType", [
  "lead_created", "lead_updated", "status_changed", "note_added", "draft_generated", "draft_updated", "draft_approved", "draft_rejected", "email_sent", "email_failed", "reply_logged", "discovery_saved", "telegram_alerted", "recipient_suppressed", "recipient_unsuppressed", "send_blocked", "opt_out_received",
]);

export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(),
  companyName: varchar("companyName", { length: 255 }).notNull(), website: varchar("website", { length: 2048 }), industry: varchar("industry", { length: 255 }), country: varchar("country", { length: 120 }), contactEmail: varchar("contactEmail", { length: 320 }), discoverySource: varchar("discoverySource", { length: 64 }), sourceUrl: varchar("sourceUrl", { length: 2048 }), sourcePlaceId: varchar("sourcePlaceId", { length: 255 }), emailSourceUrl: varchar("emailSourceUrl", { length: 2048 }), emailConfidence: varchar("emailConfidence", { length: 32 }), status: leadStatus.notNull().default("new"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const leadNotes = mysqlTable("leadNotes", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), leadId: int("leadId").notNull(), body: text("body").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const leadActivities = mysqlTable("leadActivities", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), leadId: int("leadId").notNull(), type: activityType.notNull(), detail: text("detail"), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const outreachDrafts = mysqlTable("outreachDrafts", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), leadId: int("leadId").notNull(), subject: varchar("subject", { length: 500 }).notNull(), body: text("body").notNull(), status: draftStatus.notNull().default("draft"), failureReason: text("failureReason"), approvedAt: timestamp("approvedAt"), sentAt: timestamp("sentAt"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const smtpSettings = mysqlTable("smtpSettings", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), host: varchar("host", { length: 255 }).notNull(), port: int("port").notNull(), secure: boolean("secure").notNull().default(true), username: varchar("username", { length: 320 }).notNull(), fromName: varchar("fromName", { length: 255 }), fromEmail: varchar("fromEmail", { length: 320 }).notNull(), encryptedPassword: text("encryptedPassword").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("smtpSettings_userId_unique").on(table.userId)]);

export const telegramSettings = mysqlTable("telegramSettings", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), chatId: varchar("chatId", { length: 255 }).notNull(), encryptedBotToken: text("encryptedBotToken").notNull(), enabled: boolean("enabled").notNull().default(false), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("telegramSettings_userId_unique").on(table.userId)]);

export const senderProfiles = mysqlTable("senderProfiles", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), legalBusinessName: varchar("legalBusinessName", { length: 255 }).notNull(), postalAddress: text("postalAddress").notNull(), replyToEmail: varchar("replyToEmail", { length: 320 }).notNull(), optOutText: varchar("optOutText", { length: 500 }).notNull(), dkimSelector: varchar("dkimSelector", { length: 255 }), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("senderProfiles_userId_unique").on(table.userId)]);

export const outreachPolicies = mysqlTable("outreachPolicies", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), dailyLimit: int("dailyLimit").notNull().default(15), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("outreachPolicies_userId_unique").on(table.userId)]);

export const suppressedRecipients = mysqlTable("suppressedRecipients", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), email: varchar("email", { length: 320 }).notNull(), reason: varchar("reason", { length: 500 }).notNull(), source: varchar("source", { length: 64 }).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("suppressedRecipients_userEmail_unique").on(table.userId, table.email)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type OutreachDraft = typeof outreachDrafts.$inferSelect;
