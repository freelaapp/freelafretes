import { useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminMe, listValidationQueue } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/freela-fretes-logo.png.asset.json";
import {
  LayoutDashboard, ShieldCheck, Building2, Truck, Package, Route as RouteIcon,
  Wallet, Star, ScrollText, Users, Menu, LogOut, X,
} from "lucide-react";

type NavItem = { to: string; icon: any; label: string; superOnly?: boolean; badge?: number };

export function AdminShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = useNavigate();

  const me = useServerFn(adminMe);
  const queueFn = useServerFn(listValidationQueue);
  const meQ = useQuery({ queryKey: ["admin-me"], queryFn: () => me() });
  const validationCount = useQuery({
    queryKey: ["admin-validation-count"],
    queryFn: async () => (await queueFn({ data: { tab: "PENDING_VALIDATION" } })).length,
    refetchInterval: 30_000,
  });

  const items: NavItem[] = [
    { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/admin/validation", icon: ShieldCheck, label: "Validação de Empresas", badge: validationCount.data ?? 0 },
    { to: "/admin/contractors", icon: Building2, label: "Empresas" },
    { to: "/admin/providers", icon: Truck, label: "Motoristas" },
    { to: "/admin/freights", icon: Package, label: "Fretes" },
    { to: "/admin/jobs", icon: RouteIcon, label: "Viagens" },
    { to: "/admin/payments", icon: Wallet, label: "Pagamentos" },
    { to: "/admin/feedbacks", icon: Star, label: "Avaliações" },
    { to: "/admin/audit", icon: ScrollText, label: "Auditoria" },
    { to: "/admin/team", icon: Users, label: "Equipe", superOnly: true },
  ];

  async function logout() {
    await supabase.auth.signOut();
    nav({ to: "/admin/login" });
  }

  const visible = items.filter((i) => !i.superOnly || meQ.data?.role === "SUPER_ADMIN");

  return (
    <div className="min-h-screen w-full flex bg-muted/30 text-foreground">
      <aside className={`${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 bg-accent text-accent-foreground border-r border-black/20 flex flex-col transition-transform`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <img src={logoAsset.url} alt="" className="h-8 w-8 object-contain" />
            <div>
              <p className="font-display text-lg leading-none tracking-wide">Freela Fretes</p>
              <p className="text-[10px] opacity-70 uppercase tracking-widest">Painel Admin</p>
            </div>
          </div>
          <button className="lg:hidden p-1" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {visible.map((it) => {
            const active = pathname === it.to || (it.to !== "/admin" && pathname.startsWith(it.to));
            return (
              <Link key={it.to} to={it.to} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-0.5 ${active ? "bg-primary text-primary-foreground font-semibold" : "text-white/80 hover:bg-white/5"}`}>
                <it.icon className="h-4 w-4" />
                <span className="flex-1">{it.label}</span>
                {it.badge != null && it.badge > 0 && (
                  <span className="text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5">{it.badge}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <p className="text-xs font-semibold truncate">{meQ.data?.name}</p>
          <p className="text-[11px] opacity-70 truncate">{meQ.data?.email}</p>
          <p className="text-[10px] mt-1 uppercase tracking-wider opacity-70">{meQ.data?.role}</p>
          <button onClick={logout} className="mt-3 w-full flex items-center justify-center gap-2 rounded-md bg-white/10 hover:bg-white/20 text-xs py-2">
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden h-14 border-b bg-card px-4 flex items-center gap-3">
          <button onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
          <span className="font-display text-lg">Freela Fretes · Admin</span>
        </header>
        <main className="flex-1 p-4 lg:p-8 max-w-[1400px] w-full">{children}</main>
      </div>
    </div>
  );
}
