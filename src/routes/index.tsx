import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Truck, Package, MapPin, Lock, Search, Handshake, ShieldCheck, Route as RouteIcon,
  Menu, X, Linkedin, Facebook, Instagram, Flag, ArrowRight,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { VEHICLE_TYPES, CARGO_TYPES, UF_LIST } from "@/lib/constants";
import { formatDateBR } from "@/lib/format";
import truckPhoto from "@/assets/freela-truck.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Freela Fretes — Intermediador nacional de fretes" },
      { name: "description", content: "Conectamos embarcadores a caminhoneiros autônomos em todo o Brasil. Publique cargas, encontre fretes e feche negócio com pagamento protegido." },
      { property: "og:title", content: "Freela Fretes — Intermediador nacional de fretes" },
      { property: "og:description", content: "Publique cargas ou encontre fretes em todo o Brasil com pagamento protegido." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Landing,
});

/* ============================================================
   HELPERS
   ============================================================ */

const nfInt = new Intl.NumberFormat("pt-BR");
const nfMoney = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function formatKm(km: number) {
  if (km >= 1_000_000) return `${(km / 1_000_000).toFixed(1)} mi`;
  if (km >= 1000) return `${(km / 1000).toFixed(0)} mil`;
  return nfInt.format(km);
}
function formatMoneyShort(cents: number) {
  const r = cents / 100;
  if (r >= 1_000_000) return `R$ ${(r / 1_000_000).toFixed(1)} mi`;
  if (r >= 1000) return `R$ ${(r / 1000).toFixed(0)} mil`;
  return nfMoney.format(r);
}

/* ============================================================
   LANDING
   ============================================================ */

function Landing() {
  return (
    <div className="min-h-dvh bg-secondary/40">
      <TopNav />
      <main className="mx-auto max-w-6xl px-5 md:px-8 py-6 md:py-10 space-y-10 md:space-y-16">
        <Hero />
        <StatsBar />
        <PublicFreights />
        <HowItWorks />
        <Simulator />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ============================================================
   TOP NAV
   ============================================================ */

function TopNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b border-border">
      <div className="mx-auto max-w-6xl px-5 md:px-8 h-16 md:h-20 flex items-center justify-between gap-4">
        <Link to="/" className="shrink-0"><Logo size={36} /></Link>
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-foreground/80">
          <a href="#fretes" className="hover:text-primary">Fretes</a>
          <a href="#empresas" className="hover:text-primary">Para Empresas</a>
          <a href="#motoristas" className="hover:text-primary">Para Motoristas</a>
          <a href="#como-funciona" className="hover:text-primary">Como Funciona</a>
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <Link to="/auth" className="px-5 py-2.5 rounded-full bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent-hover">
            Entrar
          </Link>
          <Link to="/cadastro/empresa" className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover">
            Criar conta
          </Link>
        </div>
        <button className="md:hidden p-2 -mr-2" onClick={() => setOpen((v) => !v)} aria-label="Abrir menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="px-5 py-4 flex flex-col gap-3 text-sm font-medium">
            <a href="#fretes" onClick={() => setOpen(false)}>Fretes</a>
            <a href="#empresas" onClick={() => setOpen(false)}>Para Empresas</a>
            <a href="#motoristas" onClick={() => setOpen(false)}>Para Motoristas</a>
            <a href="#como-funciona" onClick={() => setOpen(false)}>Como Funciona</a>
            <div className="flex gap-2 pt-2">
              <Link to="/auth" className="flex-1 text-center px-4 py-2.5 rounded-full bg-accent text-accent-foreground font-semibold">Entrar</Link>
              <Link to="/cadastro/empresa" className="flex-1 text-center px-4 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold">Criar conta</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

/* ============================================================
   HERO
   ============================================================ */

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent via-accent to-accent-hover shadow-elevated">
      <div className="grid md:grid-cols-2 gap-6 items-center p-6 md:p-10 min-h-[420px] md:min-h-[500px]">
        <div className="text-accent-foreground max-w-xl">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
            <Flag className="h-3.5 w-3.5" /> Marketplace nacional de fretes
          </span>
          <h1 className="mt-3 font-display text-4xl md:text-6xl leading-[1.05] text-primary-foreground">
            Sua carga tem pressa.<br />
            <span className="text-primary">Seu caminhão tem destino.</span>
          </h1>
          <p className="mt-4 text-sm md:text-base text-primary-foreground/80">
            O marketplace que conecta embarcadores e caminhoneiros em todo o Brasil, com pagamento protegido e reputação verificada.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/cadastro/empresa" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-primary text-primary-foreground font-semibold shadow-elevated hover:bg-primary-hover">
              Tenho carga para enviar <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/cadastro/motorista" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border-2 border-primary-foreground/30 text-primary-foreground font-semibold hover:bg-primary-foreground/10">
              Sou motorista
            </Link>
          </div>
        </div>
        <div className="relative">
          <img
            src={truckPhoto.url}
            alt="Caminhão Freela Fretes na estrada"
            className="w-full h-56 md:h-[420px] object-contain md:object-cover object-center rounded-2xl"
          />
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   STATS BAR (dados reais)
   ============================================================ */

function StatsBar() {
  const { data } = useQuery({
    queryKey: ["public-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_stats");
      if (error) throw error;
      return data as { open_freights: number; drivers: number; total_km: number; gmv_cents: number };
    },
  });

  const items = [
    { icon: Package, value: nfInt.format(data?.open_freights ?? 0), label: "Fretes disponíveis" },
    { icon: Truck, value: nfInt.format(data?.drivers ?? 0), label: "Motoristas cadastrados" },
    { icon: RouteIcon, value: formatKm(data?.total_km ?? 0), label: "KMs publicados no Brasil" },
    { icon: ShieldCheck, value: formatMoneyShort(data?.gmv_cents ?? 0), label: "Em fretes transportados" },
  ];

  return (
    <section className="-mt-10 md:-mt-16 relative z-10">
      <div className="rounded-2xl bg-card shadow-elevated border border-border p-4 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <it.icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-2xl md:text-3xl leading-none text-foreground">{it.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{it.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   FRETES DISPONÍVEIS
   ============================================================ */

function PublicFreights() {
  const [originUf, setOriginUf] = useState("");
  const [destUf, setDestUf] = useState("");
  const [cargo, setCargo] = useState("");
  const [vt, setVt] = useState("");

  const { data: freights = [] } = useQuery({
    queryKey: ["public-freights", originUf, destUf, cargo, vt],
    queryFn: async () => {
      let q = supabase.from("freights_public")
        .select("*")
        .order("pickup_at", { ascending: true })
        .limit(9);
      if (originUf) q = q.eq("origin_uf", originUf);
      if (destUf) q = q.eq("destination_uf", destUf);
      if (cargo) q = q.eq("cargo_type", cargo);
      if (vt) q = q.contains("vehicle_types", [vt]);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <section id="fretes" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-3xl md:text-4xl text-foreground">Fretes disponíveis agora</h2>
          <p className="text-sm text-muted-foreground mt-1">Cadastre-se para ver valores, propor e fechar negócio.</p>
        </div>
        <Link to="/auth" className="hidden md:inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-hover">
          Ver todos <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Filtros */}
      <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-2">
        <Select value={originUf} onChange={setOriginUf} placeholder="UF origem" options={["", ...UF_LIST]} />
        <Select value={destUf} onChange={setDestUf} placeholder="UF destino" options={["", ...UF_LIST]} />
        <Select value={cargo} onChange={setCargo} placeholder="Tipo de carga" options={["", ...CARGO_TYPES]} />
        <Select value={vt} onChange={setVt} placeholder="Veículo" options={["", ...VEHICLE_TYPES]} />
      </div>

      {freights.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center bg-card">
          <Search className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum frete encontrado com esses filtros.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {freights.map((f) => (
            <Link key={f.id} to="/auth" className="group rounded-2xl bg-card border border-border p-5 shadow-card hover:shadow-elevated hover:border-primary/40 transition">
              <p className="font-display text-xl leading-snug text-foreground">
                {f.origin_city}/{f.origin_uf} <span className="text-primary">→</span> {f.destination_city}/{f.destination_uf}
              </p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-semibold px-3 py-1">
                {f.cargo_type}
              </span>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between text-foreground/80">
                  <dt className="text-muted-foreground">Distância</dt>
                  <dd className="font-semibold">{nfInt.format(f.distance_km ?? 0)} km</dd>
                </div>
                <div className="flex items-center justify-between text-foreground/80">
                  <dt className="text-muted-foreground">Veículo</dt>
                  <dd className="font-semibold truncate max-w-[60%] text-right">
                    {(f.vehicle_types ?? []).join(", ") || "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between text-foreground/80">
                  <dt className="text-muted-foreground">Coleta</dt>
                  <dd className="font-semibold">{formatDateBR(f.pickup_at)}</dd>
                </div>
              </dl>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-accent font-bold">
                  <Lock className="h-3.5 w-3.5" /> R$ ●●●●●
                </span>
                <span className="text-xs font-semibold text-primary group-hover:underline">
                  Cadastre-se para ver o valor
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function Select({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: readonly string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      <option value="">{placeholder}</option>
      {options.filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/* ============================================================
   COMO FUNCIONA
   ============================================================ */

function HowItWorks() {
  const steps = [
    { icon: Search, title: "Publique ou encontre um frete", body: "Divulgue sua carga ou encontre o frete ideal para seu veículo de forma rápida." },
    { icon: Handshake, title: "Negocie a proposta", body: "Receba ofertas, compare preços e feche o melhor negócio diretamente pela plataforma." },
    { icon: ShieldCheck, title: "Pagamento protegido", body: "Transações seguras com pagamento garantido e liberado após a conclusão do serviço." },
    { icon: RouteIcon, title: "Colete, entregue e avalie", body: "Finalize o transporte, entregue a carga e avalie sua experiência na Freela Fretes." },
  ];
  return (
    <section id="como-funciona" className="scroll-mt-24">
      <h2 className="font-display text-3xl md:text-4xl text-foreground mb-6">Como funciona</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((s, i) => (
          <div key={s.title} className="rounded-2xl bg-card border border-border p-5 shadow-card">
            <p className="font-display text-4xl text-primary leading-none">{i + 1}</p>
            <div className="mt-4 h-12 w-12 rounded-xl bg-secondary flex items-center justify-center">
              <s.icon className="h-6 w-6 text-accent" />
            </div>
            <p className="mt-4 font-semibold text-foreground">{s.title}</p>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   SIMULADOR DE FRETE
   ============================================================ */

function Simulator() {
  const [originUf, setOriginUf] = useState("");
  const [destUf, setDestUf] = useState("");
  const [cargo, setCargo] = useState("");
  const [result, setResult] = useState<{ min: number; max: number; km: number } | null>(null);

  // Estimativa baseada na média real de fretes similares publicados
  const { data: sample = [] } = useQuery({
    queryKey: ["sim-sample", originUf, destUf, cargo],
    queryFn: async () => {
      let q = supabase.from("freights_public").select("distance_km, cargo_type").limit(200);
      if (originUf) q = q.eq("origin_uf", originUf);
      if (destUf) q = q.eq("destination_uf", destUf);
      if (cargo) q = q.eq("cargo_type", cargo);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!originUf && !!destUf,
  });

  const avgKm = useMemo(() => {
    if (!sample.length) return 0;
    return Math.round(sample.reduce((a, b: any) => a + (b.distance_km ?? 0), 0) / sample.length);
  }, [sample]);

  function simulate() {
    if (!originUf || !destUf) return;
    const km = avgKm || 800; // fallback
    // referência de mercado: R$ 3,80–R$ 5,50 por km
    const min = Math.round(km * 3.8);
    const max = Math.round(km * 5.5);
    setResult({ min, max, km });
  }

  return (
    <section id="empresas" className="scroll-mt-24">
      <div className="rounded-3xl bg-accent text-accent-foreground p-6 md:p-10 shadow-elevated">
        <div className="grid md:grid-cols-[1fr_2fr] gap-6 items-center">
          <div>
            <h2 className="font-display text-3xl md:text-4xl text-primary-foreground">Simulador de frete</h2>
            <p className="mt-2 text-sm text-primary-foreground/80">
              Descubra em segundos uma faixa de valor de referência para sua rota. Baseado em fretes reais publicados.
            </p>
          </div>
          <div className="bg-card rounded-2xl p-4 md:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <select value={originUf} onChange={(e) => setOriginUf(e.target.value)} className="w-full pl-9 pr-3 py-3 rounded-xl border border-border text-sm bg-background">
                  <option value="">UF de origem</option>
                  {UF_LIST.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="relative">
                <Flag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <select value={destUf} onChange={(e) => setDestUf(e.target.value)} className="w-full pl-9 pr-3 py-3 rounded-xl border border-border text-sm bg-background">
                  <option value="">UF de destino</option>
                  {UF_LIST.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <select value={cargo} onChange={(e) => setCargo(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-border text-sm bg-background md:col-span-1">
                <option value="">Tipo de carga</option>
                {CARGO_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                onClick={simulate}
                disabled={!originUf || !destUf}
                className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary-hover disabled:opacity-50"
              >
                Simular valor
              </button>
            </div>
            {result && (
              <div className="mt-4 p-4 rounded-xl bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground">Faixa estimada · ~{nfInt.format(result.km)} km</p>
                <p className="mt-1 font-display text-2xl text-accent">
                  {nfMoney.format(result.min / 100 * 100)} <span className="text-muted-foreground text-lg">a</span> {nfMoney.format(result.max / 100 * 100)}
                </p>
                <Link to="/cadastro/empresa" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                  Publicar este frete agora <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   FOOTER
   ============================================================ */

function SiteFooter() {
  return (
    <footer id="motoristas" className="mt-16 bg-accent text-accent-foreground">
      <div className="mx-auto max-w-6xl px-5 md:px-8 py-12 grid grid-cols-2 md:grid-cols-5 gap-8">
        <div className="col-span-2 md:col-span-1">
          <Logo size={40} variant="onDark" />
          <p className="mt-4 text-sm text-primary-foreground/70">
            Marketplace de fretes que conecta o Brasil.
          </p>
        </div>
        <FooterCol title="Faça seu cadastro" links={[
          { label: "Entrar", to: "/auth" },
          { label: "Para Empresas", to: "/cadastro/empresa" },
          { label: "Para Motoristas", to: "/cadastro/motorista" },
        ]} />
        <FooterCol title="Categorias" links={[
          { label: "Fretes", href: "#fretes" },
          { label: "Tipos de Carga", href: "#fretes" },
          { label: "Tipos de Caminhão", href: "#fretes" },
        ]} />
        <FooterCol title="Como funciona" links={[
          { label: "Pagamento", href: "#como-funciona" },
          { label: "Avaliações", href: "#como-funciona" },
          { label: "Simulador de Frete", href: "#empresas" },
        ]} />
        <FooterCol title="Dúvidas" links={[
          { label: "FAQ", href: "#como-funciona" },
          { label: "Suporte", href: "mailto:suporte@freelafretes.com.br", external: true },
          { label: "Contato", href: "mailto:contato@freelafretes.com.br", external: true },
        ]} />
      </div>
      <div className="border-t border-primary-foreground/10">
        <div className="mx-auto max-w-6xl px-5 md:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-primary-foreground/60">
          <p>Freela Fretes © {new Date().getFullYear()} · Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <a href="#" aria-label="LinkedIn" className="hover:text-primary"><Linkedin className="h-4 w-4" /></a>
            <a href="#" aria-label="Facebook" className="hover:text-primary"><Facebook className="h-4 w-4" /></a>
            <a href="#" aria-label="Instagram" className="hover:text-primary"><Instagram className="h-4 w-4" /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}

type FooterLink = { label: string; to?: string; href?: string; external?: boolean };
function FooterCol({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <p className="font-display text-sm text-primary-foreground mb-3">{title}</p>
      <ul className="space-y-2 text-sm text-primary-foreground/70">
        {links.map((l) => (
          <li key={l.label}>
            {l.to ? (
              <Link to={l.to} className="hover:text-primary">{l.label}</Link>
            ) : (
              <a href={l.href} className="hover:text-primary">{l.label}</a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
