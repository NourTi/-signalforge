import { describe, expect, it, vi } from "vitest";

vi.mock("./secretCrypto", () => ({ decryptSecret: vi.fn(() => "reply-hub-secret") }));

import { signReplyHubPayload } from "./replyHub";
import { ingestSignedInboundReply } from "./replyHubRoute";

const payload = {
  workspaceId: 7,
  messageId: "message-001",
  from: "buyer@example.com",
  to: "replies@signalforge.example",
  subject: "Please remove me",
  text: "Please unsubscribe me from future emails.",
  receivedAt: "2026-08-18T10:00:00.000Z",
};

function store(overrides: Record<string, unknown> = {}) {
  return {
    getSettings: vi.fn().mockResolvedValue({ enabled: true, inboundAddress: "replies@signalforge.example", encryptedSigningSecret: "encrypted" }),
    getByProviderId: vi.fn().mockResolvedValue(undefined),
    getByRawHash: vi.fn().mockResolvedValue(undefined),
    findLeadsByEmail: vi.fn().mockResolvedValue([{ id: 24, userId: 7, contactEmail: "buyer@example.com", status: "contacted" }]),
    upsertThread: vi.fn().mockResolvedValue(51),
    createMessage: vi.fn().mockResolvedValue(78),
    suppress: vi.fn().mockResolvedValue(undefined),
    addActivity: vi.fn().mockResolvedValue(undefined),
    updateLead: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

describe("Reply Hub inbound safeguards", () => {
  it("rejects a payload with an invalid signature before creating any inbound record", async () => {
    const persistence = store();
    const result = await ingestSignedInboundReply(JSON.stringify(payload), "sha256=wrong", payload, persistence);
    expect(result.status).toBe(401);
    expect(persistence.createMessage).not.toHaveBeenCalled();
  });

  it("rejects cross-workspace delivery when the configured inbound address differs", async () => {
    const persistence = store({ getSettings: vi.fn().mockResolvedValue({ enabled: true, inboundAddress: "private@other.example", encryptedSigningSecret: "encrypted" }) });
    const raw = JSON.stringify(payload);
    const result = await ingestSignedInboundReply(raw, signReplyHubPayload(raw, "reply-hub-secret"), payload, persistence);
    expect(result.status).toBe(403);
    expect(persistence.findLeadsByEmail).not.toHaveBeenCalled();
  });

  it("accepts a duplicate delivery without duplicating a message, activity, or response", async () => {
    const persistence = store({ getByProviderId: vi.fn().mockResolvedValue({ id: 78 }) });
    const raw = JSON.stringify(payload);
    const result = await ingestSignedInboundReply(raw, signReplyHubPayload(raw, "reply-hub-secret"), payload, persistence);
    expect(result).toMatchObject({ status: 200, body: { duplicate: true } });
    expect(persistence.createMessage).not.toHaveBeenCalled();
    expect(persistence.addActivity).not.toHaveBeenCalled();
  });

  it("classifies an opt-out, suppresses the recipient, and never exposes an auto-send path", async () => {
    const persistence = store();
    const raw = JSON.stringify(payload);
    const result = await ingestSignedInboundReply(raw, signReplyHubPayload(raw, "reply-hub-secret"), payload, persistence);
    expect(result).toMatchObject({ status: 201, body: { classification: "opt_out" } });
    expect(persistence.suppress).toHaveBeenCalledWith(7, "buyer@example.com", expect.stringContaining("opt-out"), "inbound_reply");
    expect(persistence.addActivity).toHaveBeenCalledWith(7, 24, "opt_out_received", expect.any(String));
    expect(persistence.updateLead).not.toHaveBeenCalled();
    expect(Object.keys(persistence)).not.toContain("dispatchApprovedEmail");
  });
});
