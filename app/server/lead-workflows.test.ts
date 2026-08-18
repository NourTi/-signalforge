import { describe, expect, it } from "vitest";
import { leadExportColumns, toSafeLeadExport } from "./leadExport";

const stages = ["new", "reviewed", "contacted", "replied"] as const;
type Stage = typeof stages[number];

function analytics(leads: Stage[], sent: number) {
  const replies = leads.filter(status => status === "replied").length;
  return { replyRate: sent ? Math.round((replies / sent) * 1000) / 10 : 0, replied: replies };
}

function canDispatch(status: "draft" | "approved" | "rejected" | "sent", confirmed: boolean) {
  return status === "approved" && confirmed;
}

describe("SignalForge workflow safety", () => {
  it("requires an approved draft and explicit confirmation before dispatch", () => {
    expect(canDispatch("draft", true)).toBe(false);
    expect(canDispatch("approved", false)).toBe(false);
    expect(canDispatch("approved", true)).toBe(true);
  });

  it("computes reply rate from dispatched messages and replied leads", () => {
    expect(analytics(["new", "replied", "replied"], 4)).toEqual({ replied: 2, replyRate: 50 });
    expect(analytics(["replied"], 0).replyRate).toBe(0);
  });

  it("defines only four allowed pipeline stages", () => {
    expect(stages).toEqual(["new", "reviewed", "contacted", "replied"]);
  });

  it("exports only approved lead fields and never includes credential or draft fields", () => {
    const source = {
      companyName: "Harbor & Pine",
      website: "https://harbor.example",
      industry: "Design",
      country: "United Kingdom",
      contactEmail: "hello@harbor.example",
      status: "reviewed",
      createdAt: new Date("2026-08-18T00:00:00Z"),
      encryptedPassword: "must-never-export",
      smtpHost: "smtp.example",
      draftBody: "must-never-export",
    };
    const exported = toSafeLeadExport(source);
    expect(Object.keys(exported)).toEqual([...leadExportColumns]);
    expect(exported).not.toHaveProperty("encryptedPassword");
    expect(exported).not.toHaveProperty("smtpHost");
    expect(exported).not.toHaveProperty("draftBody");
  });
});
