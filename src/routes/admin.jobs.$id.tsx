import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getJobAdmin, forceCompleteJob, cancelJobAdmin, toggleJobDispute } from "@/lib/admin.functions";
import { adminReissueTripDocuments } from "@/lib/documents.functions";
import { PageHeader, StatusBadge, ConfirmModal } from "@/components/admin/ui";
import { TripEventLog, useTripEvents } from "@/components/TripTimeline";
import { TripDocumentsCard } from "@/components/TripDocumentsCard";
import { formatBRL, formatDateTimeBR } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, Check, Clock, Package, Truck, Star, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin/jobs/$id")({
  head: () => ({ meta: [{ title: "Viagem — Admin" }, { name: "robots", content: "noindex" }] }),
  component: JobDetail,
});

function JobDetail() {
  const { id } = Route.useParams();
  const get = useServerFn(getJobAdmin);
  const force = useServerFn(forceCompleteJob);
  const cancel = useServerFn(cancelJobAdmin);
  const dispute = useServerFn(toggleJobDispute);
  const reissue = useServerFn(adminReissueTripDocuments);
  const q = useQuery({ queryKey: ["job-admin", id], queryFn: () => get({ data: { id } }) });
  const evQ = useTripEvents(id);
  const qc = useQueryClient();
  const [forceOpen, setForceOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [dispOpen, setDispOpen] = useState(false);
  const [reissueOpen, setReissueOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [reissueReason, setReissueReason] = useState("");

  const j = q.data?.job;
  const p = q.data?.payment;
  if (!j) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <Link to="/admin/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
      <PageHeader
        title={`${j.freights.origin_city}/${j.freights.origin_uf} → ${j.freights.destination_city}/${j.freights.destination_uf}`}
        subtitle={`${j.contractors.company_name} · ${j.providers.full_name} · ${formatBRL(j.agreed_amount_in_cents)}`}
        right={
          <div className="flex gap-2">
            {j.disputed && <StatusBadge tone="danger">Em disputa</StatusBadge>}
            <button onClick={() => { setDispOpen(true); setNotes(j.dispute_notes ?? ""); }} className="px-3 py-1.5 rounded-md border border-border text-sm">{j.disputed ? "Encerrar disputa" : "Abrir disputa"}</button>
            {j.status === "IN_PROGRESS" && <button onClick={() => setForceOpen(true)} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold">Forçar conclusão</button>}
            {j.status === "SCHEDULED" && <button onClick={() => setCancelOpen(true)} className="px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-sm font-semibold">Cancelar</button>}
          </div>
        }
      />

      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-semibold text-sm mb-4">Linha do tempo</h3>
        <ol className="space-y-4">
          <TimelineItem icon={Check} done label="Proposta aceita" at={j.created_at} />
          <TimelineItem icon={Clock} done={p?.status === "COMPLETED" || p?.status === "RELEASED"} label={`Pagamento (${p?.status ?? "PENDING"})`} at={p?.paid_at} />
          <TimelineItem icon={Package} done={!!q.data?.checkIn?.checked_in_at} label={`Coleta ${q.data?.checkIn ? `código ${q.data.checkIn.code}` : ""}`} at={q.data?.checkIn?.checked_in_at} />
          <TimelineItem icon={Truck} done={j.status === "IN_PROGRESS" || j.status === "COMPLETED"} label="Em trânsito" at={j.started_at} />
          <TimelineItem icon={Check} done={!!q.data?.checkOut?.checked_out_at} label={`Entrega ${q.data?.checkOut ? `código ${q.data.checkOut.code}` : ""}`} at={q.data?.checkOut?.checked_out_at} />
          <TimelineItem icon={Star} done={(q.data?.feedbacks ?? []).length > 0} label={`Avaliações (${q.data?.feedbacks.length ?? 0}/2)`} at={q.data?.feedbacks?.[0]?.created_at} />
        </ol>
      </div>

      <TripDocumentsCard
        jobId={id}
        actions={
          <button
            onClick={() => { setReissueReason(""); setReissueOpen(true); }}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reemitir
          </button>
        }
      />

      <TripEventLog events={evQ.data ?? []} />


      {j.force_completed_reason && (
        <div className="bg-warning/10 border border-warning/40 rounded-xl p-4 text-sm">
          <p className="font-semibold">Conclusão forçada por admin</p>
          <p className="text-muted-foreground mt-1">{j.force_completed_reason}</p>
        </div>
      )}
      {j.disputed && j.dispute_notes && (
        <div className="bg-destructive/10 border border-destructive/40 rounded-xl p-4 text-sm">
          <p className="font-semibold text-destructive">Disputa aberta</p>
          <p className="text-muted-foreground mt-1">{j.dispute_notes}</p>
        </div>
      )}

      <ConfirmModal open={forceOpen} onClose={() => setForceOpen(false)}
        title="Forçar conclusão" description="Marca a viagem como concluída e libera o pagamento."
        tone="primary" confirmLabel="Concluir" requireText="CONCLUIR"
        onConfirm={async () => {
          if (reason.trim().length < 3) { toast.error("Motivo obrigatório"); throw new Error("motivo"); }
          await force({ data: { id, reason: reason.trim() } });
          toast.success("Viagem concluída");
          qc.invalidateQueries({ queryKey: ["job-admin", id] });
        }}>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (ex.: entrega confirmada por WhatsApp)" rows={3} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
      </ConfirmModal>

      <ConfirmModal open={cancelOpen} onClose={() => setCancelOpen(false)}
        title="Cancelar viagem" tone="danger" confirmLabel="Cancelar" requireText="CANCELAR"
        onConfirm={async () => {
          if (reason.trim().length < 3) { toast.error("Motivo obrigatório"); throw new Error("motivo"); }
          await cancel({ data: { id, reason: reason.trim(), refund_type: "FULL" } });
          toast.success("Viagem cancelada e pagamento estornado");
          qc.invalidateQueries({ queryKey: ["job-admin", id] });
        }}>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo" rows={3} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
      </ConfirmModal>

      <ConfirmModal open={dispOpen} onClose={() => setDispOpen(false)}
        title={j.disputed ? "Encerrar disputa" : "Abrir disputa"}
        onConfirm={async () => {
          await dispute({ data: { id, disputed: !j.disputed, notes: notes.trim() } });
          toast.success("Atualizado");
          qc.invalidateQueries({ queryKey: ["job-admin", id] });
        }}>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas da disputa" rows={4} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
      </ConfirmModal>

      <ConfirmModal open={reissueOpen} onClose={() => setReissueOpen(false)}
        title="Reemitir documentos fiscais"
        description="Cancela os documentos atuais e emite um novo conjunto (CT-e, MDF-e, averbação e CIOT quando aplicável)."
        tone="primary" confirmLabel="Reemitir"
        onConfirm={async () => {
          if (reissueReason.trim().length < 3) { toast.error("Motivo obrigatório"); throw new Error("motivo"); }
          await reissue({ data: { job_id: id, reason: reissueReason.trim() } });
          toast.success("Documentos reemitidos");
          qc.invalidateQueries({ queryKey: ["trip-documents", id] });
        }}>
        <textarea value={reissueReason} onChange={(e) => setReissueReason(e.target.value)} placeholder="Motivo da reemissão" rows={3} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
      </ConfirmModal>
    </div>
  );
}

function TimelineItem({ icon: Icon, done, label, at }: { icon: any; done?: boolean; label: string; at?: string | null }) {
  return (
    <li className="flex items-start gap-3">
      <span className={`h-8 w-8 rounded-full grid place-items-center ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><Icon className="h-4 w-4" /></span>
      <div>
        <p className="text-sm font-medium">{label}</p>
        {at && <p className="text-xs text-muted-foreground">{formatDateTimeBR(at)}</p>}
      </div>
    </li>
  );
}
