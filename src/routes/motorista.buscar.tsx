import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AppHeader } from "@/components/AppHeader";
import { DriverStatusBanner } from "@/components/DriverStatusBanner";
import { ProviderNav } from "@/components/RoleNav";
import { Badge, SelectField } from "@/components/ui-kit";
import { VEHICLE_TYPES, CARGO_TYPES, UF_LIST } from "@/lib/constants";
import { formatBRL, formatDateBR } from "@/lib/format";
import { MapPin, Package } from "lucide-react";

export const Route = createFileRoute("/motorista/buscar")({
  head: () => ({ meta: [{ title: "Buscar Fretes — Freela Fretes" }] }),
  component: SearchFreights,
});

function SearchFreights() {
  useRequireAuth("provider");
  const auth = useAuth();
  const [originUf, setOu] = useState("");
  const [destUf, setDu] = useState("");
  const [cargo, setCargo] = useState("");
  const [vt, setVt] = useState("");
  const [onlyCompatible, setOnlyCompatible] = useState(true);

  const { data: myVehicles = [] } = useQuery({
    enabled: !!auth.user,
    queryKey: ["my-vehicles-compat", auth.user?.id],
    queryFn: async () => {
      const { data: p } = await supabase.from("providers").select("id").eq("user_id", auth.user!.id).maybeSingle();
      if (!p) return [];
      const { data } = await supabase.from("vehicles").select("vehicle_type,body_type").eq("provider_id", p.id);
      return data ?? [];
    },
  });

  const myVehicleTypes = useMemo(() => new Set(myVehicles.map((v) => v.vehicle_type)), [myVehicles]);
  const myBodyTypes = useMemo(() => new Set(myVehicles.map((v) => v.body_type)), [myVehicles]);

  const { data: freights = [] } = useQuery({
    queryKey: ["driver-freights", originUf, destUf, cargo, vt],
    queryFn: async () => {
      let q = supabase.from("freights").select("*").eq("status", "OPEN").order("pickup_at", { ascending: true }).limit(100);
      if (originUf) q = q.eq("origin_uf", originUf);
      if (destUf) q = q.eq("destination_uf", destUf);
      if (cargo) q = q.eq("cargo_type", cargo);
      if (vt) q = q.contains("vehicle_types", [vt]);
      const { data } = await q;
      return data ?? [];
    },
  });

  function compat(f: { vehicle_types: string[] | null; body_types: string[] | null }) {
    const vtOk = !f.vehicle_types?.length || f.vehicle_types.some((t) => myVehicleTypes.has(t));
    const btOk = !f.body_types?.length || f.body_types.some((t) => myBodyTypes.has(t));
    const missing: string[] = [];
    if (!vtOk) missing.push(...(f.vehicle_types ?? []));
    if (!btOk) missing.push(...(f.body_types ?? []));
    return { ok: vtOk && btOk, missing };
  }

  const visible = onlyCompatible && myVehicles.length > 0
    ? freights.filter((f) => compat(f).ok)
    : freights;

  return (
    <div className="pb-24">
      <AppHeader title="Buscar fretes" subtitle="Encontre sua próxima viagem" />
      <div className="px-4 pt-3 grid grid-cols-2 gap-2">
        <SelectField label="Origem" value={originUf} onChange={setOu} options={UF_LIST} placeholder="UF" />
        <SelectField label="Destino" value={destUf} onChange={setDu} options={UF_LIST} placeholder="UF" />
        <SelectField label="Carga" value={cargo} onChange={setCargo} options={CARGO_TYPES} placeholder="Tipo" />
        <SelectField label="Veículo" value={vt} onChange={setVt} options={VEHICLE_TYPES} placeholder="Tipo" />
      </div>
      {myVehicles.length > 0 && (
        <div className="px-4 pt-3">
          <label className="flex items-center gap-2 text-sm select-none cursor-pointer">
            <input
              type="checkbox"
              checked={onlyCompatible}
              onChange={(e) => setOnlyCompatible(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span>Somente compatíveis com meus veículos</span>
          </label>
        </div>
      )}
      <div className="px-4 pt-4 space-y-3">
        {visible.length === 0 && <p className="text-sm text-muted-foreground text-center py-12">Nenhum frete encontrado.</p>}
        {visible.map((f) => {
          const perKm = f.base_amount_in_cents && f.distance_km ? f.base_amount_in_cents / f.distance_km / 100 : 0;
          const c = compat(f);
          return (
            <Link key={f.id} to="/motorista/frete/$id" params={{ id: f.id }} className="block rounded-2xl bg-card border border-border p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {f.origin_city}/{f.origin_uf}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3 text-accent" /> {f.destination_city}/{f.destination_uf}</p>
                  <p className="mt-1 text-sm font-semibold truncate">{f.title}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
                    <Package className="h-3 w-3" /> {f.cargo_type} · {f.cargo_weight_kg} kg · {f.distance_km} km
                  </p>
                  <p className="text-[11px] text-muted-foreground">Coleta: {formatDateBR(f.pickup_at)}</p>
                  {myVehicles.length > 0 && (
                    <div className="mt-2">
                      {c.ok ? (
                        <Badge tone="success">✓ Compatível com seu veículo</Badge>
                      ) : (
                        <Badge tone="warning">Exige {Array.from(new Set(c.missing)).join(", ")}</Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-primary font-bold text-base">{formatBRL(f.base_amount_in_cents)}</p>
                  <p className="text-[10px] text-muted-foreground">R$ {perKm.toFixed(2)}/km</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <ProviderNav />
    </div>
  );
}
