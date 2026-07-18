import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generatePickupCode, generateDeliveryCode, submitFeedback, cancelFreight } from "@/lib/api.functions";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AppHeader } from "@/components/AppHeader";
import { Badge, ButtonPrimary, ButtonOutline, TextArea } from "@/components/ui-kit";
import { TripChecklist, TripEventLog, useTripEvents } from "@/components/TripTimeline";
import { TripDocumentsCard } from "@/components/TripDocumentsCard";
import { formatBRL, formatDateBR } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, Star } from "lucide-react";

export const Route = createFileRoute("/embarcador/viagem/$id")({
  head: () => ({ meta: [{ title: "Viagem — Freela Fretes" }] }),
  component: TripDetail,
});

function TripDetail() {
  const { id } = Route.useParams();
  useRequireAuth("contractor");
  const qc = useQueryClient();
  const genPickup = useServerFn(generatePickupCode);
  const genDelivery = useServerFn(generateDeliveryCode);
  const feedback = useServerFn(submitFeedback);
  const cancel = useServerFn(cancelFreight);

  const { data: job } = useQuery({
    queryKey: ["job-detail", id],
    queryFn: async () => {
      const { data } = await supabase.from("jobs")
        .select("*, freights(*), providers(full_name), payments(*), check_ins(code,checked_in_at), check_outs(code,checked_out_at)")
        .eq("id", id).maybeSingle();
      return data;
    },
  });

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [pickupCode, setPickupCode] = useState<string | null>(null);
  const [deliveryCode, setDeliveryCode] = useState<string | null>(null);

  async function onGenPickup() {
    try { const r = await genPickup({ data: { job_id: id } }); setPickupCode(r.code); toast.success("Código gerado"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }
  async function onGenDelivery() {
    try { const r = await genDelivery({ data: { job_id: id } }); setDeliveryCode(r.code); toast.success("Código gerado"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }
  async function submitRating() {
    try { await feedback({ data: { job_id: id, role: "CONTRACTOR", rating, comment } }); toast.success("Avaliação enviada"); qc.invalidateQueries(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }
  async function onCancel() {
    if (!confirm("Cancelar essa viagem?")) return;
    try { await cancel({ data: { freight_id: (job?.freights as { id: string }).id } }); toast.success("Cancelada"); qc.invalidateQueries(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  const evQ = useTripEvents(id);

  if (!job) return <div className="p-6 text-sm">Carregando...</div>;
  const f = job.freights as { id: string; title: string; origin_city: string; origin_uf: string; destination_city: string; destination_uf: string; pickup_at: string };
  const p = job.providers as { full_name: string };
  const pay = (Array.isArray(job.payments) ? job.payments[0] : job.payments) as { status: string; paid_at?: string; held_at?: string; released_at?: string } | null;
  const paid = pay?.status === "HELD" || pay?.status === "COMPLETED" || pay?.status === "RELEASED";
  const ackAt = (job as any).driver_ack_at as string | null;

  return (
    <div className="pb-10">
      <AppHeader title="Viagem" right={<Link to="/embarcador/viagens"><ArrowLeft className="h-5 w-5" /></Link>} />
      <div className="px-4 pt-4 space-y-3">
        <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm">{f.title}</p>
            <StatusBadge s={job.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{f.origin_city}/{f.origin_uf} → {f.destination_city}/{f.destination_uf}</p>
          <p className="text-xs text-muted-foreground">Motorista: {p.full_name} · Coleta: {formatDateBR(f.pickup_at)}</p>
          <p className="mt-2 text-primary font-bold">{formatBRL(job.agreed_amount_in_cents)}</p>
        </div>

        <TripChecklist events={evQ.data ?? []} jobStatus={job.status} />

        {job.disputed && (
          <div className="rounded-2xl bg-destructive/10 border border-destructive p-4 text-sm">
            <p className="font-semibold text-destructive">Viagem em disputa</p>
            <p className="text-xs text-muted-foreground mt-1">Uma ocorrência foi reportada. O pagamento está retido até análise.</p>
          </div>
        )}

        {job.status === "SCHEDULED" && !paid && (
          <div className="rounded-2xl bg-warning/10 border border-warning p-4">
            <p className="text-sm font-semibold">Aguardando pagamento</p>
            <p className="text-xs text-muted-foreground">O motorista será confirmado após a compensação.</p>
            <div className="mt-3">
              <Link to="/embarcador/pagamento/$jobId" params={{ jobId: id }}>
                <ButtonPrimary>Ir para pagamento</ButtonPrimary>
              </Link>
            </div>
          </div>
        )}

        {job.status === "SCHEDULED" && paid && (
          <>
            <PaymentTimeline pay={pay} />
            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-sm font-semibold">Ciência do motorista</p>
              {ackAt ? (
                <p className="mt-1 text-xs text-success">✓ Motorista confirmou os dados em {formatDateBR(ackAt)}</p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Aguardando o motorista confirmar os dados do carregamento antes da coleta.</p>
              )}
            </div>
            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-sm font-semibold">Código de coleta</p>
              <p className="text-xs text-muted-foreground">Compartilhe com o motorista no ato da coleta.</p>
              {pickupCode ? (
                <p className="mt-3 text-3xl font-black tracking-widest text-primary text-center py-2">{pickupCode}</p>
              ) : (
                <div className="mt-3"><ButtonPrimary onClick={onGenPickup} disabled={!ackAt}>Gerar código de COLETA</ButtonPrimary></div>
              )}
              {!ackAt && <p className="mt-2 text-[11px] text-muted-foreground">Disponível após a ciência do motorista.</p>}
            </div>
            <ButtonOutline onClick={onCancel}>Cancelar viagem</ButtonOutline>
          </>
        )}

        {job.status === "IN_PROGRESS" && (
          <div className="rounded-2xl bg-card border border-border p-4">
            <p className="text-sm font-semibold">Código de entrega</p>
            <p className="text-xs text-muted-foreground">Repasse ao destinatário para confirmar a entrega.</p>
            {deliveryCode ? (
              <p className="mt-3 text-3xl font-black tracking-widest text-primary text-center py-2">{deliveryCode}</p>
            ) : (
              <div className="mt-3"><ButtonPrimary onClick={onGenDelivery}>Gerar código de ENTREGA</ButtonPrimary></div>
            )}
          </div>
        )}

        {job.status === "COMPLETED" && (
          <>
            <PaymentTimeline pay={pay} />
            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-sm font-semibold">Avaliar motorista</p>
              <Stars value={rating} onChange={setRating} />
              <div className="mt-2"><TextArea label="Comentário" value={comment} onChange={setComment} /></div>
              <div className="mt-2"><ButtonPrimary onClick={submitRating}>Enviar avaliação</ButtonPrimary></div>
            </div>
          </>
        )}

        {paid && <TripDocumentsCard jobId={id} />}
        <TripEventLog events={evQ.data ?? []} />
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

export function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1 mt-2">
      {[1,2,3,4,5].map((i) => (
        <button key={i} onClick={() => onChange(i)} type="button">
          <Star className={`h-7 w-7 ${i <= value ? "fill-accent text-accent" : "text-border"}`} />
        </button>
      ))}
    </div>
  );
}

function PaymentTimeline({ pay }: { pay: { status: string; paid_at?: string; held_at?: string; released_at?: string } | null }) {
  if (!pay) return null;
  const steps = [
    { key: "paid", label: "PIX pago", at: pay.paid_at, done: !!pay.paid_at },
    { key: "held", label: "Retido em garantia", at: pay.held_at, done: !!pay.held_at || pay.status === "HELD" || pay.status === "COMPLETED" || pay.status === "RELEASED" },
    { key: "released", label: "Liberado ao motorista", at: pay.released_at, done: pay.status === "RELEASED" },
  ];
  return (
    <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
      <p className="text-sm font-semibold mb-3">Linha do tempo do pagamento</p>
      <ol className="space-y-2">
        {steps.map((s) => (
          <li key={s.key} className="flex items-start gap-3">
            <span className={`mt-1 h-3 w-3 rounded-full ${s.done ? "bg-success" : "bg-border"}`} />
            <div className="flex-1">
              <p className={`text-sm ${s.done ? "font-semibold" : "text-muted-foreground"}`}>{s.label}</p>
              {s.at && <p className="text-[11px] text-muted-foreground">{new Date(s.at).toLocaleString("pt-BR")}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
