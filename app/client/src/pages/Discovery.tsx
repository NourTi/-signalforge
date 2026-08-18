import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { AtSign, Check, ChevronDown, CircleCheck, CircleDashed, ExternalLink, Globe2, MapPin, Radar, Search, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

type Mode = "quick" | "contact";

export default function Discovery() {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ keyword: "", industry: "", businessType: "", city: "", country: "", mode: "quick" as Mode, maxResults: "5" });
  const [results, setResults] = useState<Array<{ companyName: string; formattedAddress: string; businessTypes: string[]; placeId: string; website: string | null; sourceUrl: string | null; contactEmail: string | null; emailSourceUrl: string | null; emailConfidence: "mailto" | "visible" | null }>>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const search = trpc.discovery.search.useMutation({
    onSuccess: data => { setResults(data); setSavedIds(new Set()); toast.success(`${data.length} public business results ready for review`); },
    onError: error => toast.error(error.message),
  });
  const save = trpc.discovery.save.useMutation({
    onSuccess: async (data, variables) => {
      setSavedIds(current => new Set([...Array.from(current), variables.sourcePlaceId || variables.companyName]));
      await Promise.all([utils.lead.list.invalidate(), utils.lead.analytics.invalidate()]);
      toast[data.duplicate ? "message" : "success"](data.duplicate ? "This business is already in your pipeline" : data.telegramAlerted ? "Lead saved; Telegram alert delivered" : "Lead saved to your pipeline");
    },
    onError: error => toast.error(error.message),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    search.mutate({ ...form, maxResults: Number(form.maxResults) });
  };
  const saveResult = (result: typeof results[number]) => save.mutate({
    companyName: result.companyName,
    website: result.website || "",
    industry: result.businessTypes.slice(0, 2).join(" · "),
    country: form.country,
    contactEmail: result.contactEmail || "",
    sourceUrl: result.sourceUrl || "",
    sourcePlaceId: result.placeId,
    emailSourceUrl: result.emailSourceUrl || "",
    emailConfidence: result.emailConfidence,
  });
  return <AppShell eyebrow="SignalForge / public discovery" title="Find the right business first." description="Search public business listings, inspect the official website, and surface only visible business contact emails. You review each result before it becomes a lead." action={<span className="hidden items-center gap-2 rounded-xl border border-[#d7e4ca] bg-[#f0f7e5] px-3 py-2 text-[10px] font-bold text-[#55734f] xl:flex"><ShieldCheck size={14} /> Public source · user review</span>}>
    <section className="soft-card overflow-hidden rounded-2xl border border-[#dfe7dc] bg-white">
      <div className="flex flex-col gap-4 border-b border-[#e4ebe1] p-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="mono text-[9px] font-bold uppercase tracking-[.16em] text-[#738473]">Discovery controls</p><h2 className="display-serif mt-1 text-2xl tracking-[-.04em]">Start with a specific market.</h2></div>
        <div className="flex items-center gap-2 rounded-xl bg-[#eff5e9] px-3 py-2 text-[10px] text-[#5e715e]"><CircleDashed size={14} /> Results are not saved until you choose them.</div>
      </div>
      <form onSubmit={submit} className="grid gap-4 p-5 lg:grid-cols-12">
        <FormField className="lg:col-span-3" label="What businesses are you looking for? *"><Input autoFocus required value={form.keyword} onChange={event => setForm({ ...form, keyword: event.target.value })} placeholder="e.g. boutique web design agencies" /></FormField>
        <FormField className="lg:col-span-2" label="Industry"><Input value={form.industry} onChange={event => setForm({ ...form, industry: event.target.value })} placeholder="Creative services" /></FormField>
        <FormField className="lg:col-span-2" label="Business type"><Input value={form.businessType} onChange={event => setForm({ ...form, businessType: event.target.value })} placeholder="Agency, cafe…" /></FormField>
        <FormField className="lg:col-span-2" label="City / region"><Input value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} placeholder="Manchester" /></FormField>
        <FormField className="lg:col-span-2" label="Country"><Input value={form.country} onChange={event => setForm({ ...form, country: event.target.value })} placeholder="United Kingdom" /></FormField>
        <FormField className="lg:col-span-1" label="Results"><Select value={form.maxResults} onValueChange={maxResults => setForm({ ...form, maxResults })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="3">3</SelectItem><SelectItem value="5">5</SelectItem><SelectItem value="10">10</SelectItem></SelectContent></Select></FormField>
        <div className="lg:col-span-8"><Label className="text-[11px] font-bold text-[#536753]">Scan mode</Label><div className="mt-1.5 grid gap-2 sm:grid-cols-2"><ModeButton active={form.mode === "quick"} icon={<Zap size={15} />} title="Quick scan" detail="Official homepage only" onClick={() => setForm({ ...form, mode: "quick" })} /><ModeButton active={form.mode === "contact"} icon={<AtSign size={15} />} title="Public contact scan" detail="Homepage + likely same-domain contact pages" onClick={() => setForm({ ...form, mode: "contact" })} /></div></div>
        <div className="flex items-end lg:col-span-4"><Button type="submit" disabled={search.isPending} className="press h-10 w-full rounded-xl bg-[#204226] text-xs font-bold text-white hover:bg-[#2b5933]"><Search size={15} />{search.isPending ? "Searching public sources…" : "Find businesses"}</Button></div>
      </form>
    </section>
    <section className="mt-6">
      <div className="mb-4 flex items-center justify-between"><div><p className="mono text-[9px] font-bold uppercase tracking-[.16em] text-[#738473]">Review results</p><p className="mt-1 text-xs text-[#768676]">Official websites are linked so you can validate every business and email source.</p></div>{results.length > 0 && <span className="mono rounded-full bg-[#e8f1de] px-3 py-1.5 text-[9px] font-bold text-[#4e6c4d]">{results.length} found</span>}</div>
      {search.isPending ? <LoadingResults /> : results.length ? <div className="grid gap-4 xl:grid-cols-2">{results.map(result => { const saved = savedIds.has(result.placeId); return <article key={result.placeId} className="soft-card rounded-2xl border border-[#dfe7dc] bg-white p-5"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eaf2e2] text-[#315f3b]"><Radar size={17} /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-[#293e2b]">{result.companyName}</h3><p className="mt-1 flex items-start gap-1 text-[11px] leading-4 text-[#748274]"><MapPin className="mt-0.5 shrink-0" size={12} />{result.formattedAddress}</p></div><Badge className="shrink-0 bg-[#edf4e9] text-[#4e714f]">Places</Badge></div><div className="mt-3 flex flex-wrap gap-1.5">{result.businessTypes.slice(0, 3).map(type => <span key={type} className="rounded-full bg-[#f3f6f1] px-2 py-1 text-[9px] font-semibold text-[#6d7d6c]">{type.replaceAll("_", " ")}</span>)}</div></div></div><div className="mt-5 grid gap-3 rounded-xl bg-[#f7f9f5] p-3"><SourceRow icon={<Globe2 size={14} />} label="Official website" value={result.website} href={result.website} empty="No website was supplied by the listing" /><SourceRow icon={<AtSign size={14} />} label="Public business email" value={result.contactEmail} href={result.emailSourceUrl} empty="No visible email found on the scanned official pages" badge={result.emailConfidence} /></div><div className="mt-4 flex items-center justify-between gap-3"><p className="max-w-[230px] text-[10px] leading-4 text-[#788877]">{result.contactEmail ? "Email shown with its official source URL. Delivery is not verified." : "Save this business without an email, then research it manually."}</p><Button onClick={() => saveResult(result)} disabled={saved || save.isPending} className="press shrink-0 rounded-xl bg-[#204226] text-[10px] font-bold text-white hover:bg-[#2b5933]">{saved ? <><Check size={13} /> Saved</> : <><CircleCheck size={13} /> Save lead</>}</Button></div></article>; })}</div> : <EmptyDiscovery />}
    </section>
  </AppShell>;
}

function FormField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) { return <div className={className}><Label className="text-[11px] font-bold text-[#536753]">{label}</Label><div className="mt-1.5">{children}</div></div>; }
function ModeButton({ active, title, detail, icon, onClick }: { active: boolean; title: string; detail: string; icon: React.ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className={"flex items-center gap-3 rounded-xl border p-3 text-left transition " + (active ? "border-[#769974] bg-[#edf5e7] text-[#294e31]" : "border-[#dfe7dc] bg-white text-[#657565] hover:bg-[#f5f8f2]")}><span className={"grid h-7 w-7 place-items-center rounded-lg " + (active ? "bg-[#254b2b] text-[#d9edab]" : "bg-[#eff4eb] text-[#708070]")}>{icon}</span><span><strong className="block text-[11px]">{title}</strong><small className="block text-[10px] opacity-70">{detail}</small></span></button>; }
function SourceRow({ icon, label, value, href, empty, badge }: { icon: React.ReactNode; label: string; value: string | null; href: string | null; empty: string; badge?: string | null }) { return <div className="flex gap-2"><span className="mt-0.5 text-[#5a7d59]">{icon}</span><div className="min-w-0"><p className="mono text-[8px] font-bold uppercase tracking-[.14em] text-[#859584]">{label}</p>{value ? <div className="mt-0.5 flex items-center gap-2"><a href={href || undefined} target="_blank" rel="noreferrer" className="max-w-[220px] truncate text-[11px] font-bold text-[#2e6539] hover:underline">{value}</a>{href && <ExternalLink size={11} className="shrink-0 text-[#719170]" />}{badge && <span className="rounded-full bg-[#e6f0df] px-1.5 py-0.5 text-[8px] font-bold text-[#5e7b58]">{badge}</span>}</div> : <p className="mt-0.5 text-[10px] text-[#8a9789]">{empty}</p>}</div></div>; }
function EmptyDiscovery() { return <div className="rounded-2xl border border-dashed border-[#cbd8c6] bg-white/70 px-6 py-16 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#e9f2e1] text-[#315f3b]"><Radar size={19} /></span><p className="display-serif mt-4 text-2xl tracking-[-.04em]">Your search will appear here.</p><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#7b8a79]">Choose a precise market and location. SignalForge searches public business listings, checks the official site, then lets you decide what belongs in your pipeline.</p></div>; }
function LoadingResults() { return <div className="grid gap-4 xl:grid-cols-2">{[0, 1, 2, 3].map(item => <div key={item} className="h-64 animate-pulse rounded-2xl border border-[#e1e8de] bg-white/70" />)}</div>; }
