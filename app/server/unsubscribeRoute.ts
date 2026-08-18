import type { Express } from "express";
import { addActivity, listLeadsByContactEmail, suppressRecipient } from "./db";
import { validUnsubscribeSignature } from "./compliance";

function page(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — SignalForge</title><style>body{margin:0;background:#f8faf5;color:#18271a;font-family:Arial,sans-serif}.wrap{max-width:560px;margin:14vh auto;padding:32px}.card{background:#fff;border:1px solid #dce4d9;border-radius:20px;padding:32px;box-shadow:0 12px 30px rgba(33,53,38,.06)}h1{font-family:Georgia,serif;font-size:32px;letter-spacing:-.04em;margin:0 0 12px}p{line-height:1.6;color:#5e705f}.mark{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:#e7f0dd;color:#315e3a;font-weight:bold;margin-bottom:20px}</style></head><body><main class="wrap"><section class="card"><div class="mark">S</div><h1>${title}</h1><p>${body}</p></section></main></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] || character);
}

export async function applySignedOptOut(input: { userId: number; email: string; signature: string }, persistence: { suppress: (userId: number, email: string) => Promise<void>; matchingLeadIds: (userId: number, email: string) => Promise<number[]>; addAudit: (userId: number, leadId: number) => Promise<void> }) {
  if (!Number.isInteger(input.userId) || input.userId <= 0 || !input.email || !input.signature || !validUnsubscribeSignature(input.userId, input.email, input.signature)) return false;
  await persistence.suppress(input.userId, input.email);
  const leadIds = await persistence.matchingLeadIds(input.userId, input.email);
  await Promise.all(leadIds.map(leadId => persistence.addAudit(input.userId, leadId)));
  return true;
}

export function registerUnsubscribeRoute(app: Express) {
  app.get("/unsubscribe", async (req, res) => {
    const userId = Number(req.query.u); const email = typeof req.query.e === "string" ? req.query.e : ""; const signature = typeof req.query.s === "string" ? req.query.s : "";
    try {
      const applied = await applySignedOptOut({ userId, email, signature }, { suppress: (ownerId, recipient) => suppressRecipient(ownerId, recipient, "Recipient used the signed unsubscribe link", "opt_out"), matchingLeadIds: async (ownerId, recipient) => (await listLeadsByContactEmail(ownerId, recipient)).map(lead => lead.id), addAudit: (ownerId, leadId) => addActivity(ownerId, leadId, "opt_out_received", "Recipient used the signed unsubscribe link") });
      if (!applied) { res.status(400).send(page("This link is invalid", "Please reply directly to the sender if you would like to stop receiving messages.")); return; }
      res.send(page("You are unsubscribed", `Future marketing email to ${escapeHtml(email)} has been blocked for this sender.`));
    } catch {
      res.status(500).send(page("We could not complete your request", "Please reply directly to the sender to request that future messages stop."));
    }
  });
}
