import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { cn } from "@/lib/utils";
import { BarChart3, BookOpenText, ChevronRight, Database, FilePenLine, Inbox, LayoutDashboard, LogOut, Menu, Radar, Settings2, ShieldCheck, Sparkles, UsersRound, X } from "lucide-react";
import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";

const nav = [
  { href: "/", label: "Command center", icon: LayoutDashboard },
  { href: "/discover", label: "Business discovery", icon: Radar },
  { href: "/leads", label: "Lead pipeline", icon: UsersRound },
  { href: "/outreach", label: "Review queue", icon: FilePenLine },
  { href: "/reply-hub", label: "Reply hub", icon: Inbox },
  { href: "/strategy", label: "Field guides", icon: BookOpenText },
  { href: "/compliance", label: "Compliance center", icon: ShieldCheck },
  { href: "/settings", label: "Delivery settings", icon: Settings2 },
];

export function AppShell({ eyebrow, title, description, children, action }: { eyebrow: string; title: string; description: string; children: ReactNode; action?: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const rail = (
    <aside className="flex h-full min-h-screen w-[272px] flex-col border-r border-[#dce4d9] bg-[#111813] px-4 py-5 text-[#eef4e9]">
      <Link href="/" className="mb-10 flex items-center gap-3 px-2" onClick={() => setOpen(false)}>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d9edab] text-[#18371e] shadow-[0_8px_24px_rgba(192,238,105,.15)]"><Sparkles size={17} strokeWidth={2.5} /></span>
        <span><strong className="block text-[15px] tracking-[-.04em]">SignalForge</strong><span className="mono block text-[9px] uppercase tracking-[.22em] text-[#8fa08b]">Verified prospecting</span></span>
      </Link>
      <nav className="space-y-1">
        <p className="mono mb-3 px-3 text-[9px] font-medium uppercase tracking-[.18em] text-[#71836e]">Workspace</p>
        {nav.map(item => {
          const Icon = item.icon;
          const current = location === item.href;
          return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={cn("group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors", current ? "bg-[#2b3b2c] text-white" : "text-[#aab8a7] hover:bg-[#1d2a1e] hover:text-white")}><Icon size={16} strokeWidth={current ? 2.4 : 1.8} /><span className="flex-1">{item.label}</span>{current && <ChevronRight size={14} />}</Link>;
        })}
      </nav>
      <div className="mt-auto space-y-3">
        <div className="rounded-xl border border-[#334336] bg-[#18241a] p-3">
          <div className="mb-2 flex items-center gap-2 text-[#d9edab]"><ShieldCheck size={14} /><span className="mono text-[9px] uppercase tracking-[.13em]">Human-in-control</span></div>
          <p className="text-[11px] leading-5 text-[#a9b7a7]">Every email must be reviewed, approved, and confirmed before dispatch.</p>
        </div>
        {loading ? <div className="h-11 animate-pulse rounded-xl bg-[#1d2a1e]" /> : user ? <div className="flex items-center gap-2 rounded-xl border border-[#334336] p-2"><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#d9edab] text-xs font-bold text-[#17361e]">{user.name?.slice(0, 1).toUpperCase() || "U"}</div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold">{user.name || "Workspace owner"}</p><p className="truncate text-[10px] text-[#9cae99]">{user.email || "Signed in"}</p></div><button onClick={logout} className="rounded-md p-1.5 text-[#9cae99] hover:bg-[#314334] hover:text-white" aria-label="Sign out"><LogOut size={14} /></button></div> : <button onClick={() => startLogin()} className="press flex w-full items-center justify-center gap-2 rounded-xl bg-[#d9edab] px-3 py-2.5 text-xs font-bold text-[#18371e] hover:bg-[#e4f7b7]"><Database size={14} /> Secure sign in</button>}
      </div>
    </aside>
  );
  return <div className="min-h-screen bg-[#f8faf5] text-[#18271a]"><div className="fixed inset-0 -z-10 paper-grid opacity-40" /><button onClick={() => setOpen(!open)} className="fixed left-4 top-4 z-50 grid h-10 w-10 place-items-center rounded-xl border border-[#dce4d9] bg-white text-[#18371e] shadow-sm lg:hidden" aria-label="Open navigation">{open ? <X size={18} /> : <Menu size={18} />}</button><div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block">{rail}</div>{open && <div className="fixed inset-0 z-40 bg-[#111813]/40 backdrop-blur-sm lg:hidden"><div className="h-full w-[272px] shadow-2xl">{rail}</div></div>}<main className="min-h-screen lg:ml-[272px]"><header className="flex min-h-[164px] items-end justify-between gap-6 border-b border-[#dce4d9] px-6 pb-8 pt-20 sm:px-10 lg:px-12 lg:pt-10"><div className="max-w-2xl"><p className="mono mb-3 text-[10px] font-medium uppercase tracking-[.18em] text-[#658065]">{eyebrow}</p><h1 className="display-serif text-[35px] font-semibold leading-none tracking-[-.05em] text-[#18271a] sm:text-[44px]">{title}</h1><p className="mt-3 max-w-xl text-[13px] leading-6 text-[#637365]">{description}</p></div><div className="hidden shrink-0 sm:block">{action}</div></header>{!user && !loading && <div className="mx-6 mt-6 flex items-start gap-3 rounded-2xl border border-[#d6e6a8] bg-[#f2f9dc] p-4 text-[#486047] sm:mx-10 lg:mx-12"><ShieldCheck className="mt-0.5 shrink-0" size={17} /><p className="text-xs leading-5"><strong className="font-bold">Private workspace.</strong> Sign in to add leads, create drafts, or configure your own SMTP account. No prospect data is visible until your authenticated session is active.</p></div>}<section className="px-6 py-7 sm:px-10 lg:px-12 lg:py-9">{children}</section></main></div>;
}

export function MetricCard({ label, value, detail, accent = "moss", icon: Icon }: { label: string; value: string | number; detail: string; accent?: "moss" | "sun" | "ink"; icon: typeof BarChart3 }) {
  const color = accent === "sun" ? "bg-[#f5edc8] text-[#5f5320]" : accent === "ink" ? "bg-[#203a25] text-[#e5f1d7]" : "bg-[#e8f1dc] text-[#294c2f]";
  return <article className="soft-card rounded-2xl border border-[#dfe7dc] bg-white p-5"><div className="mb-7 flex items-center justify-between"><p className="mono text-[9px] font-medium uppercase tracking-[.16em] text-[#728271]">{label}</p><span className={cn("grid h-8 w-8 place-items-center rounded-lg", color)}><Icon size={15} /></span></div><p className="display-serif text-4xl font-semibold tracking-[-.06em]">{value}</p><p className="mt-2 text-[11px] text-[#758374]">{detail}</p></article>;
}
