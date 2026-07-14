import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Building2, Lock, MapPin, Package, Search } from "lucide-react";
import { Logo } from "@/components/Logo";
import { VEHICLE_TYPES, CARGO_TYPES, UF_LIST } from "@/lib/constants";
import { formatDateBR } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Freela Fretes — Maior portal de fretes do Brasil" },
      { name: "description", content: "Publique cargas ou encontre fretes em todo o Brasil. Motoristas autônomos e embarcadores conectados." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="pb-10">
      {/* Header */}
      <header className="px-5 pt-5 pb-3 flex items-center justify-between">
        <Logo size={40} />
        <Link to="/auth" className="text-sm font-semibold text-accent">Entrar</Link>
      </header>


      {/* Hero */}
      <section className="px-5 pt-4 pb-8">
        <h1 className="text-3xl font-black leading-tight text-foreground">
          Sua carga tem pressa.<br />
          <span className="text-primary">Seu caminhão tem destino.</span>
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          O marketplace que conecta embarcadores a motoristas autônomos em todo o Brasil.
        </p>
        <div className="mt-6 space-y-3">
          <Link to="/cadastro/empresa" className="flex items-center gap-3 w-full rounded-2xl bg-primary text-primary-foreground px-4 py-4 shadow-elevated">
            <Building2 className="h-6 w-6 shrink-0" />
            <div className="text-left">
              <p className="font-bold">Tenho carga para enviar</p>
              <p className="text-xs opacity-80">Cadastre-se como empresa</p>
            </div>
          </Link>
          <Link to="/cadastro/motorista" className="flex items-center gap-3 w-full rounded-2xl bg-accent text-accent-foreground px-4 py-4 shadow-elevated">
            <Truck className="h-6 w-6 shrink-0" />
            <div className="text-left">
              <p className="font-bold">Sou motorista</p>
              <p className="text-xs opacity-90">Encontre o próximo frete</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Vitrine */}
      <PublicFreights />
    </div>
  );
}

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
        .limit(50);
      if (originUf) q = q.eq("origin_uf", originUf);
      if (destUf) q = q.eq("destination_uf", destUf);
      if (cargo) q = q.eq("cargo_type", cargo);
      if (vt) q = q.contains("vehicle_types", [vt]);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: totalCount } = useQuery({
    queryKey: ["public-freights-count"],
    queryFn: async () => {
      const { count } = await supabase.from("freights_public").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  return (
    <section className="px-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-foreground">Fretes disponíveis</h2>
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Filtros */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Select value={originUf} onChange={setOriginUf} placeholder="UF origem" options={["", ...UF_LIST]} />
        <Select value={destUf} onChange={setDestUf} placeholder="UF destino" options={["", ...UF_LIST]} />
        <Select value={cargo} onChange={setCargo} placeholder="Tipo de carga" options={["", ...CARGO_TYPES]} />
        <Select value={vt} onChange={setVt} placeholder="Veículo" options={["", ...VEHICLE_TYPES]} />
      </div>

      <div className="mt-4 space-y-3">
        {freights.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum frete encontrado.</p>
        )}
        {freights.map((f) => (
          <Link key={f.id} to="/auth" className="block rounded-2xl bg-card border border-border p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {f.origin_city}/{f.origin_uf}
                </div>
                <div className="my-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 text-accent" /> {f.destination_city}/{f.destination_uf}
                </div>
                <p className="mt-1 font-semibold text-sm truncate">{f.title}</p>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" />{f.cargo_type}</span>
                  <span>· {((f.cargo_weight_kg ?? 0) / 1000).toLocaleString("pt-BR")} t</span>
                  <span>· {f.distance_km} km</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Coleta: {formatDateBR(f.pickup_at)}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="inline-flex items-center gap-1 text-primary font-bold">
                  <Lock className="h-3 w-3" /> R$ ●●●●●
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Cadastre-se<br/>para ver</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        + de <span className="font-bold text-primary">{totalCount ?? 0}</span> fretes publicados
      </p>
    </section>
  );
}

function Select({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: readonly string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
    >
      <option value="">{placeholder}</option>
      {options.filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
