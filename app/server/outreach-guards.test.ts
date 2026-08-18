import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addActivity: vi.fn(), getDraft: vi.fn(), getLead: vi.fn(), getSenderProfile: vi.fn(), getSmtpSettings: vi.fn(), getOutreachPolicy: vi.fn(), getSuppressedRecipient: vi.fn(), countSentToday: vi.fn(),
}));

vi.mock("./db", () => ({
  addActivity: mocks.addActivity, getDraft: mocks.getDraft, getLead: mocks.getLead, getSenderProfile: mocks.getSenderProfile, getSmtpSettings: mocks.getSmtpSettings, getOutreachPolicy: mocks.getOutreachPolicy, getSuppressedRecipient: mocks.getSuppressedRecipient, countSentToday: mocks.countSentToday,
  addNote: vi.fn(), createDraft: vi.fn(), createLead: vi.fn(), deleteLead: vi.fn(), getLeadWorkspace: vi.fn(), getTelegramSettings: vi.fn(), getReplyHubSettings: vi.fn(), getReplyThread: vi.fn(), listInboundMessages: vi.fn().mockResolvedValue([]), listReplyThreads: vi.fn().mockResolvedValue([]), listDrafts: vi.fn().mockResolvedValue([]), listLeads: vi.fn().mockResolvedValue([]), listSuppressedRecipients: vi.fn().mockResolvedValue([]), saveReplyHubSettings: vi.fn(), saveReplyThreadDraft: vi.fn(), saveOutreachPolicy: vi.fn(), saveSenderProfile: vi.fn(), saveSmtpSettings: vi.fn(), saveTelegramSettings: vi.fn(), suppressRecipient: vi.fn(), unsuppressRecipient: vi.fn(), updateDraft: vi.fn(), updateLead: vi.fn(),
}));
vi.mock("./_core/llm", () => ({ listLLMModels: vi.fn(), invokeLLM: vi.fn() }));
vi.mock("./_core/systemRouter", () => ({ systemRouter: {} }));
vi.mock("./_core/cookies", () => ({ getSessionCookieOptions: vi.fn(() => ({})) }));
vi.mock("./email", () => ({ dispatchApprovedEmail: vi.fn() }));
vi.mock("./secretCrypto", () => ({ decryptSecret: vi.fn(() => "secret"), encryptSecret: vi.fn(value => value) }));
vi.mock("./discovery", () => ({ findPublicBusinesses: vi.fn(), hasDiscoveryDuplicate: vi.fn() }));
vi.mock("./telegram", () => ({ sendTelegramAlert: vi.fn(), shouldDeliverDiscoverySaveAlert: vi.fn() }));
vi.mock("./compliance", async importOriginal => {
  const actual = await importOriginal<typeof import("./compliance")>();
  return { ...actual, checkSenderDomain: vi.fn(async () => ({ ready: false, domain: "example.com", spfReady: false, dkimReady: false, dmarcReady: false })) };
});

import { appRouter } from "./routers";

const user = { id: 7, openId: "owner", name: "Owner", email: "owner@example.com", loginMethod: "manus", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
const ctx = { user, req: { protocol: "https", get: () => "signalforge.example", headers: {} }, res: { clearCookie: vi.fn() } } as any;
const lead = { id: 10, userId: 7, companyName: "Target Co", contactEmail: "contact@target.example", status: "new" as const };
const draft = { id: 11, userId: 7, leadId: 10, subject: "A relevant idea", body: "A short body", status: "draft" as const };

describe("outreach workflow safeguards", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.addActivity.mockResolvedValue(undefined); mocks.getLead.mockResolvedValue(lead); mocks.getSuppressedRecipient.mockResolvedValue(undefined); mocks.getSenderProfile.mockResolvedValue(undefined); mocks.getDraft.mockResolvedValue(draft); mocks.getSmtpSettings.mockResolvedValue({ host: "smtp.example.com", port: 465, secure: true, username: "owner@example.com", fromName: "Owner", fromEmail: "owner@example.com", encryptedPassword: "encrypted" }); mocks.getOutreachPolicy.mockResolvedValue({ dailyLimit: 15 }); mocks.countSentToday.mockResolvedValue(0);
  });

  it("blocks draft approval until the commercial sender profile exists", async () => {
    const caller = appRouter.createCaller(ctx);
    await expect(caller.outreach.approve({ draftId: 11 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "Commercial sender profile is required." });
    expect(mocks.addActivity).toHaveBeenCalledWith(7, 10, "send_blocked", expect.stringContaining("Approval blocked"));
  });

  it("blocks AI draft generation for a suppressed recipient", async () => {
    mocks.getSuppressedRecipient.mockResolvedValue({ id: 1, email: "contact@target.example" });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.outreach.generate({ leadId: 10, offer: "Improve your new-business research and outreach process", tone: "consultative" })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Recipient is suppressed." });
  });

  it("blocks final dispatch when sender DNS readiness is incomplete", async () => {
    mocks.getDraft.mockResolvedValue({ ...draft, status: "approved" });
    mocks.getSenderProfile.mockResolvedValue({ legalBusinessName: "Northstar Ltd", postalAddress: "10 Market Street, London", replyToEmail: "reply@example.com", optOutText: "Reply unsubscribe to stop", dkimSelector: "selector1" });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.outreach.send({ draftId: 11, confirmation: true })).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "Sender-domain readiness is incomplete." });
    expect(mocks.addActivity).toHaveBeenCalledWith(7, 10, "send_blocked", expect.stringContaining("Sender-domain readiness"));
  });
});
