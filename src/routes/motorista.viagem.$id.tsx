import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { confirmPickup, confirmDelivery, submitFeedback, driverWithdrawFromJob } from "@/lib/api.functions";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AppHeader } from "@/components/AppHeader";
import { Badge, ButtonPrimary, ButtonOutline, Field, TextArea } from "@/components/ui-kit";
import { formatBRL, formatDateBR, normalizeCode } from "@/lib/format";
import { Stars } from "./embarcador.viagem.$id";
import { toast } from "sonner";
import { ArrowLeft, Truck } from "lucide-react";

export const Route = createFileRoute("/motorista/viagem/$id")({
  head: () => ({ meta: [{ title: "Viagem — Freela Fretes" }] }),
  component: DriverTripDetail,
});

function DriverTripDetail() {
  const { id } = Route.useParams();
  useRequireAuth("provider");
  const qc = useQueryClient();
  const doPickup = useServerFn(confirmPickup);
  const doDelivery = useServerFn(confirmDelivery);
  const fb = useServerFn(submitFeedback);
  const withdraw = useServerFn(driverWithdrawFromJob);

  const { data: job } = useQuery({
    queryKey: ["driver-job", id],
    queryFn: async () => (await supabase.from("jobs")
      .select("*, freights(*), contractors(company_name)")
      .eq("id", id).maybeSingle()).data,
  });

  const [pcode, setPcode] = useState("");
  const [dcode, setDcode] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  async function onPickup() {
    try { await doPickup({ data: { job_id: id, code: pcode } }); toast.success("Coleta confirmada!"); qc.invalidateQueries(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }
  async function onDelivery() {
    try { await doDelivery({ data: { job_id: id, code: dcode } }); toast.success("Entrega confirmada!"); qc.invalidateQueries(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }
  async function onWithdraw() {
    if (!confirm("Desistir? O frete voltará a ficar aberto.")) return;
    try { await withdraw({ data: { job_id: id } }); toast.success("Você desistiu"); qc.invalidateQueries(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }
  async function submitRating() {
    try { await fb({ data: { job_id: id, role: "PROVIDER", rating, comment } }); toast.success("Avaliação enviada"); qc.invalidateQueries(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  if (!job) return <div className="p-6 text-sm">Carregando...</div>;
  const f = job.freights as { title: string; origin_city: string; origin_uf: string; destination_city: string; destination_uf: string; pickup_at: string };
  const c = job.contractors as { company_name: string };

  return (
    <div className="pb-10">
      <AppHeader title="Viagem" right={<Link to="/motorista/viagens"><ArrowLeft className="h-5 w-5" /></Link>} />
      <div className="px-4 pt-4 space-y-3">
        <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm">{f.title}</p>
            <StatusBadge s={job.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{f.origin_city}/{f.origin_uf} → {f.destination_city}/{f.destination_uf}</p>
          <p className="text-xs text-muted-foreground">Empresa: {c.company_name} · Coleta: {formatDateBR(f.pickup_at)}</p>
          <p className="mt-2 text-primary font-bold">{formatBRL(job.agreed_amount_in_cents)}</p>
        </div>

        {job.status === "SCHEDULED" && (
          <>
            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-sm font-semibold">Confirmar coleta</p>
              <p className="text-xs text-muted-foreground">Digite o código de 6 caracteres recebido do embarcador.</p>
              <div className="mt-3">
                <Field label="Código de coleta" value={pcode} onChange={(v) => setPcode(normalizeCode(v))} placeholder="ABC123" />
              </div>
              <div className="mt-3"><ButtonPrimary onClick={onPickup} disabled={pcode.length !== 6}>Confirmar coleta</ButtonPrimary></div>
            </div>
            <ButtonOutline onClick={onWithdraw}>Desistir</ButtonOutline>
          </>
        )}

        {job.status === "IN_PROGRESS" && (
          <>
            <div className="rounded-2xl bg-accent/10 border border-accent p-4 flex gap-3">
              <Truck className="h-6 w-6 text-accent shrink-0" />
              <p className="text-sm font-semibold">Carga em trânsito 🚛</p>
            </div>
            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-sm font-semibold">Confirmar entrega</p>
              <Field label="Código de entrega" value={dcode} onChange={(v) => setDcode(normalizeCode(v))} placeholder="XYZ789" />
              <div className="mt-3"><ButtonPrimary onClick={onDelivery} disabled={dcode.length !== 6}>Confirmar entrega</ButtonPrimary></div>
            </div>
          </>
        )}

        {job.status === "COMPLETED" && (
          <>
            <div className="rounded-2xl bg-success/10 border border-success p-4">
              <p className="text-sm font-semibold">Frete concluído!</p>
              <p className="text-xs text-muted-foreground">O pagamento de {formatBRL(job.agreed_amount_in_cents)} será transferido via PIX ✓</p>
            </div>
            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-sm font-semibold">Avaliar empresa</p>
              <Stars value={rating} onChange={setRating} />
              <div className="mt-2"><TextArea label="Comentário" value={comment} onChange={setComment} /></div>
              <div className="mt-2"><ButtonPrimary onClick={submitRating}>Enviar avaliação</ButtonPrimary></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const m: Record<string, [string, "warning" | "accent" | "success" | "muted"]> = {
    SCHEDULED: ["Agendada", "warning"],
    IN_PROGRESS: ["Em andamento", "accent"],
    COMPLETED: ["Concluída", "success"],
    CANCELLED: ["Cancelada", "muted"],
  };
  const [l, t] = m[s] ?? [s, "muted"];
  return <Badge tone={t}>{l}</Badge>;
}
