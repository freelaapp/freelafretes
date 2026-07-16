import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { submitCandidacy } from "@/lib/api.functions";
import { useAuth } from "@/hooks/use-auth";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AppHeader } from "@/components/AppHeader";
import { Field, TextArea, ButtonPrimary } from "@/components/ui-kit";
import { formatBRL, formatDateBR } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Package, Truck } from "lucide-react";

export const Route = createFileRoute("/motorista/frete/$id")({
  head: () => ({ meta: [{ title: "Detalhe do Frete — Freela Fretes" }] }),
  component: DriverFreightDetail,
});

function DriverFreightDetail() {
  const { id } = Route.useParams();
  useRequireAuth("provider");
  const auth = useAuth();
  const nav = useNavigate();
  const submit = useServerFn(submitCandidacy);

  const { data: freight } = useQuery({
    queryKey: ["driver-freight", id],
    queryFn: async () => (await supabase.from("freights").select("*").eq("id", id).maybeSingle()).data,
  });

  const { data: vehicles = [] } = useQuery({
    enabled: !!auth.user,
    queryKey: ["my-vehicles", auth.user?.id],
    queryFn: async () => {
      const { data: p } = await supabase.from("providers").select("id").eq("user_id", auth.user!.id).maybeSingle();
      if (!p) return [];
      const { data } = await supabase.from("vehicles").select("*").eq("provider_id", p.id);
      return data ?? [];
    },
  });

  const [vehicleId, setVehicleId] = useState("");
  const [mode, setMode] = useState<"accept" | "counter">("accept");
  const [counter, setCounter] = useState<number>(0);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  async function send() {
    if (!vehicleId) return toast.error("Selecione o veículo");
    if (mode === "counter" && counter <= 0) return toast.error("Informe o valor");
    setLoading(true);
    try {
      await submit({ data: {
        freight_id: id, vehicle_id: vehicleId,
        proposed_amount_reais: mode === "counter" ? counter : null,
        message: msg || null,
      } });
      toast.success("Proposta enviada!");
      nav({ to: "/motorista/propostas" });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setLoading(false); }
  }

  if (!freight) return <div className="p-6 text-sm">Carregando...</div>;

  return (
    <div className="pb-10">
      <AppHeader title="Detalhe do frete" right={<Link to="/motorista/buscar"><ArrowLeft className="h-5 w-5" /></Link>} />
      <div className="px-4 pt-4 space-y-3">
        <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
          <p className="font-bold">{freight.title}</p>
          <div className="mt-2 text-xs text-muted-foreground space-y-1">
            <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {freight.origin_city}/{freight.origin_uf} → {freight.destination_city}/{freight.destination_uf}</p>
            <p className="flex items-center gap-1"><Package className="h-3 w-3" /> {freight.cargo_type} · {freight.cargo_weight_kg} kg · {freight.distance_km} km</p>
            {freight.vehicle_types?.length ? <p className="flex items-center gap-1"><Truck className="h-3 w-3" /> {freight.vehicle_types.join(", ")}</p> : null}
            {freight.body_types?.length ? <p>Carrocerias: {freight.body_types.join(", ")}</p> : null}
            <p>Coleta: {formatDateBR(freight.pickup_at)}</p>
            {freight.description && <p className="mt-2 italic">{freight.description}</p>}
          </div>
          <p className="mt-3 text-primary font-bold text-xl">{formatBRL(freight.base_amount_in_cents)}</p>
        </div>

        <ButtonPrimary onClick={() => setShowModal(true)}>Enviar proposta</ButtonPrimary>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowModal(false)}>
          <div className="bg-card w-full max-w-[480px] rounded-t-3xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto h-1 w-10 rounded-full bg-border" />
            <p className="font-bold">Enviar proposta</p>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Veículo</span>
              <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm">
                <option value="">Escolha</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicle_type} · {v.body_type} · {v.plate}</option>)}
              </select>
            </label>
            <div className="flex gap-2">
              <label className={`flex-1 rounded-xl border p-3 text-center text-sm ${mode === "accept" ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border"}`}>
                <input type="radio" checked={mode === "accept"} onChange={() => setMode("accept")} className="hidden" />
                Aceitar valor
              </label>
              <label className={`flex-1 rounded-xl border p-3 text-center text-sm ${mode === "counter" ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border"}`}>
                <input type="radio" checked={mode === "counter"} onChange={() => setMode("counter")} className="hidden" />
                Contraproposta
              </label>
            </div>
            {mode === "counter" && (
              <Field label="Sua proposta (R$)" type="number" value={String(counter || "")} onChange={(v) => setCounter(parseFloat(v) || 0)} />
            )}
            <TextArea label="Mensagem (opcional, máx 500)" value={msg} onChange={(v) => setMsg(v.slice(0, 500))} />
            <ButtonPrimary onClick={send} disabled={loading}>{loading ? "Enviando..." : "Enviar"}</ButtonPrimary>
          </div>
        </div>
      )}
    </div>
  );
}
