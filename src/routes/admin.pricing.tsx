import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  loadPricingConfig, updatePricingSettings,
  updatePricingVehicleCost, updatePricingCargoFactor,
} from "@/lib/pricing.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/pricing")({
  head: () => ({ meta: [{ title: "Precificação — Admin" }, { name: "robots", content: "noindex" }] }),
  component: PricingAdmin,
});

function PricingAdmin() {
  const loadFn = useServerFn(loadPricingConfig);
  const q = useQuery({ queryKey: ["admin-pricing"], queryFn: () => loadFn() });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (q.isError || !q.data) return <p className="text-sm text-destructive">Erro ao carregar configuração.</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Precificação</h1>
        <p className="text-sm text-muted-foreground mt-1">Todas as alterações são registradas no histórico e aplicadas em tempo real ao simulador e à publicação de fretes.</p>
      </div>

      <VehicleCostsPanel rows={q.data.vehicleCosts} onSaved={() => q.refetch()} />
      <CargoFactorsPanel rows={q.data.cargoFactors} onSaved={() => q.refetch()} />
      <SettingsPanel settings={q.data.settings} onSaved={() => q.refetch()} />
      <HistoryPanel entries={q.data.history} />
    </div>
  );
}

// ------- Veículos -------
function VehicleCostsPanel({ rows, onSaved }: { rows: any[]; onSaved: () => void }) {
  const fn = useServerFn(updatePricingVehicleCost);
  const mut = useMutation({ mutationFn: (v: any) => fn({ data: v }), onSuccess: () => { toast.success("Atualizado"); onSaved(); } });
  return (
    <section className="rounded-2xl bg-card border border-border p-5">
      <h2 className="font-display text-xl mb-3">Custos por veículo</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground border-b">
            <tr><th className="py-2">Veículo</th><th>R$/km</th><th>Frete mínimo</th><th>Capacidade (kg)</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => <VehicleRow key={r.vehicle_type} row={r} onSave={mut.mutate} pending={mut.isPending} />)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function VehicleRow({ row, onSave, pending }: { row: any; onSave: (v: any) => void; pending: boolean }) {
  const [ckm, setCkm] = useState(String((row.ckm_cents_por_km / 100).toFixed(2)));
  const [min, setMin] = useState(String((row.frete_minimo_cents / 100).toFixed(0)));
  const [cap, setCap] = useState(String(row.capacidade_kg));
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 font-semibold uppercase">{row.vehicle_type}</td>
      <td><input value={ckm} onChange={(e) => setCkm(e.target.value)} className="w-24 border rounded px-2 py-1" /></td>
      <td><input value={min} onChange={(e) => setMin(e.target.value)} className="w-24 border rounded px-2 py-1" /></td>
      <td><input value={cap} onChange={(e) => setCap(e.target.value)} className="w-24 border rounded px-2 py-1" /></td>
      <td>
        <button disabled={pending} onClick={() => onSave({
          vehicle_type: row.vehicle_type,
          ckm_cents_por_km: Math.round(parseFloat(ckm.replace(",", ".")) * 100),
          frete_minimo_cents: Math.round(parseFloat(min.replace(",", ".")) * 100),
          capacidade_kg: parseInt(cap) || 0,
        })} className="px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-semibold">Salvar</button>
      </td>
    </tr>
  );
}

// ------- Cargas -------
function CargoFactorsPanel({ rows, onSaved }: { rows: any[]; onSaved: () => void }) {
  const fn = useServerFn(updatePricingCargoFactor);
  const mut = useMutation({ mutationFn: (v: any) => fn({ data: v }), onSuccess: () => { toast.success("Atualizado"); onSaved(); } });
  return (
    <section className="rounded-2xl bg-card border border-border p-5">
      <h2 className="font-display text-xl mb-3">Fatores por tipo de carga</h2>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
        {rows.map((r) => <CargoRow key={r.cargo_type} row={r} onSave={mut.mutate} pending={mut.isPending} />)}
      </div>
    </section>
  );
}
function CargoRow({ row, onSave, pending }: { row: any; onSave: (v: any) => void; pending: boolean }) {
  const [f, setF] = useState(String(row.factor));
  return (
    <div className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm">
      <span className="flex-1 font-medium">{row.cargo_type}</span>
      <input value={f} onChange={(e) => setF(e.target.value)} className="w-16 border rounded px-2 py-1 text-right" />
      <button disabled={pending} onClick={() => onSave({ cargo_type: row.cargo_type, factor: parseFloat(f.replace(",", ".")) })}
        className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs">OK</button>
    </div>
  );
}

// ------- Settings -------
function SettingsPanel({ settings, onSaved }: { settings: Record<string, any>; onSaved: () => void }) {
  const [state, setState] = useState<Record<string, string>>({});
  useEffect(() => {
    const s: Record<string, string> = {};
    for (const [k, v] of Object.entries(settings)) s[k] = Array.isArray(v) ? v.join(",") : String(v);
    setState(s);
  }, [settings]);
  const fn = useServerFn(updatePricingSettings);
  const mut = useMutation({
    mutationFn: () => {
      const parsed: Record<string, any> = {};
      for (const [k, v] of Object.entries(state)) {
        if (k === "meses_safra") parsed[k] = v.split(",").map((x) => parseInt(x.trim())).filter((n) => !isNaN(n));
        else if (!isNaN(parseFloat(v))) parsed[k] = parseFloat(v);
        else parsed[k] = v;
      }
      return fn({ data: { settings: parsed } });
    },
    onSuccess: () => { toast.success("Configurações salvas"); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  return (
    <section className="rounded-2xl bg-card border border-border p-5">
      <h2 className="font-display text-xl mb-3">Configurações gerais</h2>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        {Object.entries(state).map(([k, v]) => (
          <label key={k} className="block text-sm">
            <span className="block text-xs text-muted-foreground mb-1">{k}</span>
            <input value={v} onChange={(e) => setState((s) => ({ ...s, [k]: e.target.value }))}
              className="w-full border rounded px-2 py-2 text-sm" />
          </label>
        ))}
      </div>
      <button disabled={mut.isPending} onClick={() => mut.mutate()}
        className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
        {mut.isPending ? "Salvando…" : "Salvar configurações"}
      </button>
    </section>
  );
}

// ------- Histórico -------
function HistoryPanel({ entries }: { entries: any[] }) {
  return (
    <section className="rounded-2xl bg-card border border-border p-5">
      <h2 className="font-display text-xl mb-3">Histórico de alterações</h2>
      {entries.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma alteração ainda.</p>}
      <ul className="space-y-2 text-sm">
        {entries.map((e) => (
          <li key={e.id} className="border-b last:border-0 pb-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{e.entity}{e.entity_key ? ` · ${e.entity_key}` : ""}</span>
              <span>{new Date(e.changed_at).toLocaleString("pt-BR")}</span>
            </div>
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-primary">Ver antes/depois</summary>
              <div className="grid sm:grid-cols-2 gap-2 mt-1 text-[11px]">
                <pre className="bg-muted rounded p-2 overflow-x-auto">{JSON.stringify(e.before, null, 2)}</pre>
                <pre className="bg-muted rounded p-2 overflow-x-auto">{JSON.stringify(e.after, null, 2)}</pre>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
