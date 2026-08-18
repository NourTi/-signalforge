import { beforeEach, describe, expect, it } from "vitest";
import { composeComplianceFooter, createUnsubscribeSignature, outboundBlockReason, outboundQuota, validUnsubscribeSignature } from "./compliance";
import { applySignedOptOut } from "./unsubscribeRoute";

describe("launch compliance controls", () => {
  beforeEach(() => { process.env.JWT_SECRET = "test-signing-key"; });

  it("accepts only an unsubscribe signature for the same workspace and recipient", () => {
    const signature = createUnsubscribeSignature(42, "contact@example.com");
    expect(validUnsubscribeSignature(42, "contact@example.com", signature)).toBe(true);
    expect(validUnsubscribeSignature(42, "other@example.com", signature)).toBe(false);
    expect(validUnsubscribeSignature(43, "contact@example.com", signature)).toBe(false);
  });

  it("adds sender identity, postal address, wording, and a signed opt-out route to every footer", () => {
    const footer = composeComplianceFooter({ legalBusinessName: "Northstar Ltd", postalAddress: "10 Market Street, London, SW1A 1AA", optOutText: "Reply unsubscribe to stop future outreach.", unsubscribeUrl: "https://signalforge.example/unsubscribe?token=signed" });
    expect(footer).toContain("Northstar Ltd");
    expect(footer).toContain("10 Market Street");
    expect(footer).toContain("Reply unsubscribe");
    expect(footer).toContain("unsubscribe?token=signed");
  });

  it("blocks sends at the configured daily cap without allowing a negative remaining count", () => {
    expect(outboundQuota({ sentToday: 3, dailyLimit: 15 })).toEqual({ sentToday: 3, dailyLimit: 15, remaining: 12, allowed: true });
    expect(outboundQuota({ sentToday: 15, dailyLimit: 15 })).toEqual({ sentToday: 15, dailyLimit: 15, remaining: 0, allowed: false });
    expect(outboundQuota({ sentToday: 20, dailyLimit: 15 })).toEqual({ sentToday: 20, dailyLimit: 15, remaining: 0, allowed: false });
  });

  it("returns the strictest send guard for suppressed contacts, missing identity, quota, and domain readiness", () => {
    expect(outboundBlockReason({ recipientSuppressed: true, profileConfigured: true, quotaAllowed: true, senderReady: true })).toBe("Recipient is suppressed.");
    expect(outboundBlockReason({ profileConfigured: false })).toBe("Commercial sender profile is required.");
    expect(outboundBlockReason({ profileConfigured: true, quotaAllowed: false })).toBe("Daily send limit reached.");
    expect(outboundBlockReason({ profileConfigured: true, quotaAllowed: true, senderReady: false })).toBe("Sender-domain readiness is incomplete.");
  });

  it("persists a signed opt-out and writes matching lead audit records", async () => {
    const signature = createUnsubscribeSignature(7, "stop@example.com"); const suppressed: string[] = []; const audited: number[] = [];
    await expect(applySignedOptOut({ userId: 7, email: "stop@example.com", signature }, { suppress: async (_userId, email) => { suppressed.push(email); }, matchingLeadIds: async () => [12, 14], addAudit: async (_userId, leadId) => { audited.push(leadId); } })).resolves.toBe(true);
    expect(suppressed).toEqual(["stop@example.com"]); expect(audited).toEqual([12, 14]);
    await expect(applySignedOptOut({ userId: 7, email: "stop@example.com", signature: "bad" }, { suppress: async () => { throw new Error("must not run"); }, matchingLeadIds: async () => [], addAudit: async () => {} })).resolves.toBe(false);
  });
});
