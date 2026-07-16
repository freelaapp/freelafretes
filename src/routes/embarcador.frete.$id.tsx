import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { acceptCandidacy, cancelFreight, rejectCandidacy } from "@/lib/api.functions";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AppHeader } from "@/components/AppHeader";
import { Badge, ButtonPrimary, ButtonOutline } from "@/components/ui-kit";
import { formatBRL, formatDateBR } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Package, Truck } from "lucide-react";

export const Route = createFileRoute("/embarcador/frete/$id")({
  head: () => ({ meta: [{ title: "Detalhe do Frete — Freela Fretes" }] }),
  component: FreightDetail,
});

function FreightDetail() {
  const { id } = Route.useParams();
  useRequireAuth("contractor");
  const nav = useNavigate();
  const qc = useQueryClient();
  const accept = useServerFn(acceptCandidacy);
  const cancel = useServerFn(cancelFreight);
  const reject = useServerFn(rejectCandidacy);

  const { data: freight } = useQuery({
    queryKey: ["freight", id],
    queryFn: async () => {
      const { data } = await supabase.from("freights").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: candidacies = [] } = useQuery({
    queryKey: ["candidacies", id],
    queryFn: async () => {
      const { data } = await supabase.from("candidacies")
        .select("*, providers(id,full_name,city,uf), vehicles(id,vehicle_type,body_type,plate,capacity_kg)")
        .eq("freight_id", id).order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  async function onAccept(cid: string) {
    if (!confirm("Confirmar aceite dessa proposta?")) return;
    try {
      const res = await accept({ data: { candidacy_id: cid } });
      toast.success("Proposta aceita!");
      nav({ to: "/embarcador/pagamento/$jobId", params: { jobId: res.job_id } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function onCancel() {
    if (!confirm("Cancelar este frete?")) return;
    try {
      await cancel({ data: { freight_id: id } });
      toast.success("Frete cancelado");
      qc.invalidateQueries();
      nav({ to: "/embarcador/fretes" });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  if (!freight) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="pb-10">
      <AppHeader title="Detalhe do frete" right={
        <Link to="/embarcador/fretes"><ArrowLeft className="h-5 w-5" /></Link>
      } />
      <div className="px-4 pt-4 space-y-3">
        <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
          <p className="font-bold">{freight.title}</p>
          <div className="mt-2 text-xs text-muted-foreground space-y-1">
            <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {freight.origin_city}/{freight.origin_uf} → {freight.destination_city}/{freight.destination_uf}</p>
            <p className="flex items-center gap-1"><Package className="h-3 w-3" /> {freight.cargo_type} · {freight.cargo_weight_kg} kg · {freight.distance_km} km</p>
            {freight.vehicle_types?.length ? <p className="flex items-center gap-1"><Truck className="h-3 w-3" /> {freight.vehicle_types.join(", ")}</p> : null}
            <p>Coleta: {formatDateBR(freight.pickup_at)}</p>
          </div>
          <p className="mt-3 text-primary font-bold text-lg">{formatBRL(freight.base_amount_in_cents)}</p>
          {freight.status === "OPEN" && (
            <div className="mt-3">
              <ButtonOutline onClick={onCancel}>Cancelar frete</ButtonOutline>
            </div>
          )}
        </div>

        <p className="text-sm font-semibold pt-2">Propostas recebidas ({candidacies.length})</p>
        {candidacies.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma proposta ainda.</p>}
        {candidacies.map((c) => {
          const diff = c.proposed_amount_in_cents != null ? c.proposed_amount_in_cents - (freight.base_amount_in_cents ?? 0) : 0;
          const provider = c.providers as { full_name: string; city: string; uf: string } | null;
          const v = c.vehicles as { vehicle_type: string; body_type: string; plate: string; capacity_kg: number } | null;
          return (
            <div key={c.id} className="rounded-2xl bg-card border border-border p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">{provider?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{provider?.city}/{provider?.uf}</p>
                </div>
                {c.status === "PENDING" && <Badge tone="warning">Pendente</Badge>}
                {c.status === "ACCEPTED" && <Badge tone="success">Aceita</Badge>}
                {c.status === "WITHDRAWN" && <Badge tone="muted">Retirada</Badge>}
                {c.status === "REJECTED" && <Badge tone="danger">Recusada</Badge>}
              </div>
              {v && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {v.vehicle_type} · {v.body_type} · {v.plate.slice(0,3)}•••{v.plate.slice(-2)} · {v.capacity_kg} kg
                </p>
              )}
              {c.message && <p className="mt-2 text-xs italic">"{c.message}"</p>}
              <div className="mt-3">
                {c.proposed_amount_in_cents == null ? (
                  <Badge tone="success">Aceita seu valor · {formatBRL(freight.base_amount_in_cents)}</Badge>
                ) : (
                  <Badge tone="accent">
                    Contraproposta: {formatBRL(c.proposed_amount_in_cents)} ({diff > 0 ? "+" : ""}{formatBRL(Math.abs(diff))})
                  </Badge>
                )}
              </div>
              {c.status === "PENDING" && freight.status === "OPEN" && (
                <div className="mt-3">
                  <ButtonPrimary onClick={() => onAccept(c.id)}>Aceitar proposta</ButtonPrimary>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
