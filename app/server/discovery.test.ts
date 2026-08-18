import { describe, expect, it } from "vitest";
import { buildDiscoveryQuery, extractPublicEmails, hasDiscoveryDuplicate, normalizePublicUrl } from "./discovery";
import { shouldDeliverDiscoverySaveAlert } from "./telegram";

describe("public discovery contact handling", () => {
  it("prefers an explicitly published mailto email and never invents an address", () => {
    const emails = extractPublicEmails(
      '<a href="mailto:hello@northstar.example">Contact us</a><p>team@northstar.example</p>',
      "https://northstar.example/contact",
    );

    expect(emails).toEqual([
      { email: "hello@northstar.example", sourceUrl: "https://northstar.example/contact", confidence: "mailto" },
      { email: "team@northstar.example", sourceUrl: "https://northstar.example/contact", confidence: "visible" },
    ]);
    expect(emails).not.toContainEqual(expect.objectContaining({ email: "info@northstar.example" }));
  });

  it("rejects localhost as an unsafe business website scan target", async () => {
    await expect(normalizePublicUrl("http://localhost:3000/contact")).rejects.toThrow("Only public business websites may be scanned.");
  });

  it("includes the chosen industry and location controls in the public-source query", () => {
    expect(buildDiscoveryQuery({ keyword: "agencies", industry: "creative services", businessType: "marketing agency", city: "Manchester", country: "United Kingdom" })).toBe("agencies creative services marketing agency Manchester United Kingdom");
  });

  it("recognizes a reviewed discovery result that is already in the user's pipeline", () => {
    expect(hasDiscoveryDuplicate([{ sourcePlaceId: "place-1", website: "https://northstar.example", contactEmail: "hello@northstar.example" }], { sourcePlaceId: "place-1" })).toBe(true);
    expect(hasDiscoveryDuplicate([{ sourcePlaceId: "place-1", website: "https://northstar.example", contactEmail: "hello@northstar.example" }], { website: "https://other.example", contactEmail: "hello@other.example" })).toBe(false);
  });

  it("only permits Telegram delivery from the explicit save path when alerts are enabled", () => {
    expect(shouldDeliverDiscoverySaveAlert({ enabled: true, explicitSave: true })).toBe(true);
    expect(shouldDeliverDiscoverySaveAlert({ enabled: false, explicitSave: true })).toBe(false);
    expect(shouldDeliverDiscoverySaveAlert({ enabled: true, explicitSave: false })).toBe(false);
  });
});
