import { lookup } from "node:dns/promises";
import { makeRequest, type PlaceDetailsResult, type PlacesSearchResult } from "./_core/map";

export type DiscoveryMode = "quick" | "contact";
export type EmailCandidate = { email: string; sourceUrl: string; confidence: "mailto" | "visible" };
export type DiscoveryResult = {
  companyName: string;
  formattedAddress: string;
  businessTypes: string[];
  placeId: string;
  website: string | null;
  sourceUrl: string | null;
  contactEmail: string | null;
  emailSourceUrl: string | null;
  emailConfidence: "mailto" | "visible" | null;
};

const privateHost = /(^localhost$|\.local$)/i;
const emailPattern = /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/gi;

function privateIp(address: string) {
  const value = address.toLowerCase();
  if (value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:" )) return true;
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
}

export async function normalizePublicUrl(value: string) {
  const url = new URL(value.startsWith("http") ? value : `https://${value}`);
  if (!["http:", "https:"].includes(url.protocol) || privateHost.test(url.hostname)) throw new Error("Only public business websites may be scanned.");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(item => privateIp(item.address))) throw new Error("Only public business websites may be scanned.");
  return url;
}

export function extractPublicEmails(html: string, sourceUrl: string): EmailCandidate[] {
  const candidates = new Map<string, EmailCandidate>();
  const mailtoPattern = /mailto:([^\s"'?#>]+)/gi;
  for (const match of Array.from(html.matchAll(mailtoPattern))) {
    const email = decodeURIComponent(match[1]).trim().toLowerCase();
    if (emailPattern.test(email)) candidates.set(email, { email, sourceUrl, confidence: "mailto" });
    emailPattern.lastIndex = 0;
  }
  for (const match of Array.from(html.matchAll(emailPattern))) {
    const email = match[0].toLowerCase();
    if (!candidates.has(email)) candidates.set(email, { email, sourceUrl, confidence: "visible" });
  }
  return Array.from(candidates.values());
}

function contactLinks(html: string, currentUrl: URL) {
  const links = new Set<string>();
  const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi;
  for (const match of Array.from(html.matchAll(hrefPattern))) {
    try {
      const url = new URL(match[1], currentUrl);
      const path = url.pathname.toLowerCase();
      if (url.hostname === currentUrl.hostname && /contact|about|team|support|impressum/.test(path)) links.add(url.toString());
    } catch { /* Ignore malformed links. */ }
  }
  return Array.from(links).slice(0, 4);
}

async function fetchPublicHtml(input: URL, redirects = 0): Promise<{ html: string; finalUrl: URL }> {
  if (redirects > 2) throw new Error("Too many website redirects.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(input, { redirect: "manual", signal: controller.signal, headers: { "User-Agent": "SignalForge/1.0 (+public-business-contact-scan)", Accept: "text/html,application/xhtml+xml" } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Website redirect has no destination.");
      return fetchPublicHtml(await normalizePublicUrl(new URL(location, input).toString()), redirects + 1);
    }
    const type = response.headers.get("content-type") || "";
    const length = Number(response.headers.get("content-length") || 0);
    if (!response.ok || !type.includes("text/html") || length > 1_000_000) throw new Error("The official website did not return a scannable HTML page.");
    const html = await response.text();
    return { html: html.slice(0, 1_000_000), finalUrl: input };
  } finally { clearTimeout(timer); }
}

async function scanOfficialWebsite(website: string, mode: DiscoveryMode) {
  const home = await fetchPublicHtml(await normalizePublicUrl(website));
  const emails = extractPublicEmails(home.html, home.finalUrl.toString());
  if (mode === "contact") {
    for (const link of contactLinks(home.html, home.finalUrl)) {
      try {
        const page = await fetchPublicHtml(await normalizePublicUrl(link));
        emails.push(...extractPublicEmails(page.html, page.finalUrl.toString()));
      } catch { /* A blocked or malformed secondary page is not a discovery failure. */ }
    }
  }
  const seen = new Map<string, EmailCandidate>();
  emails.forEach(item => { const existing = seen.get(item.email); if (!existing || item.confidence === "mailto") seen.set(item.email, item); });
  return Array.from(seen.values()).sort((a, b) => a.confidence === b.confidence ? a.email.localeCompare(b.email) : a.confidence === "mailto" ? -1 : 1)[0] || null;
}

export function buildDiscoveryQuery({ keyword, industry, businessType, city, country }: { keyword: string; industry?: string; businessType?: string; city?: string; country?: string }) {
  return [keyword, industry, businessType, city, country].filter(Boolean).join(" ").trim();
}

export function hasDiscoveryDuplicate(existing: Array<{ sourcePlaceId: string | null; website: string | null; contactEmail: string | null }>, candidate: { sourcePlaceId?: string; website?: string | null; contactEmail?: string | null }) {
  return existing.some(lead => (candidate.sourcePlaceId && lead.sourcePlaceId === candidate.sourcePlaceId) || (candidate.website && lead.website === candidate.website) || (candidate.contactEmail && lead.contactEmail === candidate.contactEmail));
}

export async function findPublicBusinesses(input: { keyword: string; industry?: string; businessType?: string; city?: string; country?: string; mode: DiscoveryMode; maxResults: number }) {
  const search = await makeRequest<PlacesSearchResult>("/maps/api/place/textsearch/json", { query: buildDiscoveryQuery(input) });
  if (search.status !== "OK" && search.status !== "ZERO_RESULTS") throw new Error("Business discovery source is temporarily unavailable.");
  const places = search.results.slice(0, input.maxResults);
  return Promise.all(places.map(async place => {
    let detail: PlaceDetailsResult["result"] | null = null;
    try {
      const response = await makeRequest<PlaceDetailsResult>("/maps/api/place/details/json", { place_id: place.place_id, fields: "name,website,formatted_address,types,place_id" });
      detail = response.result;
    } catch { /* Keep the transient business result when website lookup fails. */ }
    const website = detail?.website || null;
    let contact: EmailCandidate | null = null;
    if (website) {
      try { contact = await scanOfficialWebsite(website, input.mode); } catch { /* No public contact email is common and is shown as empty. */ }
    }
    return {
      companyName: detail?.name || place.name,
      formattedAddress: detail?.formatted_address || place.formatted_address,
      businessTypes: place.types || [],
      placeId: place.place_id,
      website,
      sourceUrl: website,
      contactEmail: contact?.email || null,
      emailSourceUrl: contact?.sourceUrl || null,
      emailConfidence: contact?.confidence || null,
    } satisfies DiscoveryResult;
  }));
}
