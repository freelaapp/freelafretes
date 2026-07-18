import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { confirmPickup, confirmDelivery, submitFeedback, driverWithdrawFromJob, driverAckJob } from "@/lib/api.functions";
import { recordTripEvent } from "@/lib/trip-events.functions";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AppHeader } from "@/components/AppHeader";
import { Badge, ButtonPrimary, ButtonOutline, Field, TextArea } from "@/components/ui-kit";
import { TripChecklist, TripEventLog, useTripEvents } from "@/components/TripTimeline";
import { TripDocumentsCard } from "@/components/TripDocumentsCard";
import { formatBRL, formatDateBR, normalizeCode } from "@/lib/format";
import { Stars } from "./embarcador.viagem.$id";
import { toast } from "sonner";
import { ArrowLeft, Truck, MapPin, Pause, Play, AlertTriangle, Navigation2, X } from "lucide-react";

export const Route = createFileRoute("/motorista/viagem/$id")({
  head: () => ({ meta: [{ title: "Viagem — Freela Fretes" }] }),
  component: DriverTripDetail,
});

const INCIDENTS: { value: "ACCIDENT" | "THEFT" | "BREAKDOWN" | "DAMAGE"; label: string }[] = [
  { value: "ACCIDENT", label: "Acidente" },
  { value: "THEFT", label: "Roubo" },
  { value: "BREAKDOWN", label: "Pane / mecânico" },
  { value: "DAMAGE", label: "Avaria na carga" },
];

function DriverTripDetail() {
  const { id } = Route.useParams();
  useRequireAuth("provider");
  const qc = useQueryClient();
  const doPickup = useServerFn(confirmPickup);
  const doDelivery = useServerFn(confirmDelivery);
  const fb = useServerFn(submitFeedback);
  const withdraw = useServerFn(driverWithdrawFromJob);
  const recordEv = useServerFn(recordTripEvent);

  const { data: job } = useQuery({
    queryKey: ["driver-job", id],
    queryFn: async () => (await supabase.from("jobs")
      .select("*, freights(*), contractors(company_name)")
      .eq("id", id).maybeSingle()).data,
  });
  const evQ = useTripEvents(id);

  const [pcode, setPcode] = useState("");
  const [dcode, setDcode] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incKind, setIncKind] = useState<typeof INCIDENTS[number]["value"]>("BREAKDOWN");
  const [incNotes, setIncNotes] = useState("");

  async function pushEvent(type: string, notes?: string, extra?: Record<string, unknown>) {
    try {
      await recordEv({ data: { job_id: id, type: type as any, notes: notes ?? null, ...(extra ?? {}) } as any });
      qc.invalidateQueries({ queryKey: ["trip-events", id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function onArrivedPickup() { await pushEvent("ARRIVED_PICKUP"); toast.success("Chegada registrada"); }
  async function onArrivedDest() { await pushEvent("ARRIVED_DESTINATION"); toast.success("Chegada ao destino registrada"); }
  const isResting = (evQ.data ?? []).reduce((r, e) => (e.type === "REST_STARTED" ? true : e.type === "REST_ENDED" ? false : r), false);
  async function onToggleRest() { await pushEvent(isResting ? "REST_ENDED" : "REST_STARTED"); toast.success(isResting ? "Viagem retomada" : "Pausa registrada"); }
  async function onIncidentSubmit() {
    if (incNotes.trim().length < 3) { toast.error("Descreva a ocorrência"); return; }
    try {
      await recordEv({ data: { job_id: id, type: "INCIDENT_REPORTED", incident_kind: incKind, notes: incNotes.trim() } });
      setIncidentOpen(false); setIncNotes("");
      toast.success("Ocorrência reportada. O pagamento foi retido.");
      qc.invalidateQueries();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

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
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(`${f.destination_city}, ${f.destination_uf}`)}&navigate=yes`;

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

        <TripChecklist events={evQ.data ?? []} jobStatus={job.status} />

        {job.disputed && (
          <div className="rounded-2xl bg-destructive/10 border border-destructive p-4 text-sm">
            <p className="font-semibold text-destructive">Viagem em disputa</p>
            <p className="text-xs text-muted-foreground mt-1">O pagamento está retido até a resolução pelo suporte.</p>
          </div>
        )}

        {job.status === "SCHEDULED" && (
          <>
            <ButtonPrimary onClick={onArrivedPickup}>📍 Cheguei para carregar</ButtonPrimary>
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
            <a href={wazeUrl} target="_blank" rel="noopener noreferrer" className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground py-3 font-semibold shadow-elevated">
              <Navigation2 className="h-4 w-4" /> Abrir rota no Waze
            </a>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onToggleRest} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-card py-2.5 text-sm font-semibold">
                {isResting ? (<><Play className="h-4 w-4" /> Retomar viagem</>) : (<><Pause className="h-4 w-4" /> Iniciar pausa</>)}
              </button>
              <button onClick={onArrivedDest} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-card py-2.5 text-sm font-semibold">
                <MapPin className="h-4 w-4" /> Cheguei ao destino
              </button>
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

        <TripDocumentsCard jobId={id} />
        <TripEventLog events={evQ.data ?? []} />

        {(job.status === "SCHEDULED" || job.status === "IN_PROGRESS") && (
          <button onClick={() => setIncidentOpen(true)} className="w-full inline-flex items-center justify-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/5 text-destructive py-2.5 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4" /> Informar ocorrência
          </button>
        )}
      </div>

      {incidentOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={() => setIncidentOpen(false)}>
          <div className="bg-card rounded-2xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Informar ocorrência</p>
              <button onClick={() => setIncidentOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">O pagamento fica retido enquanto a ocorrência estiver aberta.</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {INCIDENTS.map((i) => (
                <button key={i.value} onClick={() => setIncKind(i.value)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${incKind === i.value ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
                  {i.label}
                </button>
              ))}
            </div>
            <TextArea label="Descrição" value={incNotes} onChange={setIncNotes} placeholder="O que aconteceu?" />
            <div className="mt-3"><ButtonPrimary onClick={onIncidentSubmit}>Reportar ocorrência</ButtonPrimary></div>
          </div>
        </div>
      )}
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
