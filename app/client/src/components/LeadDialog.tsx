import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Plus } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

const blank = { companyName: "", website: "", industry: "", country: "", contactEmail: "", status: "new" as const };

export function LeadDialog({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const utils = trpc.useUtils();
  const create = trpc.lead.create.useMutation({ onSuccess: async () => { await utils.lead.list.invalidate(); await utils.lead.analytics.invalidate(); setOpen(false); setForm(blank); toast.success("Lead added to the pipeline"); }, onError: error => toast.error(error.message) });
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate(form); };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="press h-10 rounded-xl bg-[#1f4326] px-4 text-xs font-bold text-white hover:bg-[#285731]"><Plus size={15} /> {compact ? "Add lead" : "Add a lead"}</Button></DialogTrigger><DialogContent className="max-w-lg rounded-2xl border-[#dce4d9] bg-[#fdfefb] p-0"><DialogHeader className="border-b border-[#e0e7de] px-6 py-5"><DialogTitle className="display-serif text-2xl tracking-[-.04em]">Add a prospect</DialogTitle><DialogDescription className="text-xs leading-5">Start with the essential context. You can add research notes and craft a draft once saved.</DialogDescription></DialogHeader><form className="space-y-4 px-6 py-5" onSubmit={submit}><div className="grid gap-4 sm:grid-cols-2"><Field label="Company name *"><Input autoFocus required value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} placeholder="Northstar Studio" /></Field><Field label="Website"><Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://example.com" /></Field><Field label="Industry"><Input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} placeholder="Creative services" /></Field><Field label="Country"><Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} placeholder="United Kingdom" /></Field></div><Field label="Contact email"><Input type="email" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} placeholder="name@company.com" /></Field><Field label="Pipeline stage"><Select value={form.status} onValueChange={value => setForm({ ...form, status: value as typeof form.status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">New</SelectItem><SelectItem value="reviewed">Reviewed</SelectItem><SelectItem value="contacted">Contacted</SelectItem><SelectItem value="replied">Replied</SelectItem></SelectContent></Select></Field><div className="mt-6 flex justify-end gap-2"><Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" className="press rounded-xl bg-[#1f4326] text-white hover:bg-[#285731]" disabled={create.isPending}>{create.isPending ? "Saving…" : "Save prospect"}</Button></div></form></DialogContent></Dialog>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label className="text-[11px] font-bold text-[#536753]">{label}</Label>{children}</div>; }
