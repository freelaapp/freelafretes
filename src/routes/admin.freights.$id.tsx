import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFreightAdmin, adminCancelFreight, reopenFreight } from "@/lib/admin.functions";
import { PageHeader, StatusBadge, ConfirmModal, DataTable } from "@/components/admin/ui";
import { formatBRL, formatDateBR, formatDateTimeBR } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin/freights/$id")({
  head: () => ({ meta: [{ title: "Frete — Admin" }, { name: "robots", content: "noindex" }] }),
  component: FreightDetail,
});

function FreightDetail() {
  const { id } = Route.useParams();
  const get = useServerFn(getFreightAdmin);
  const cancel = useServerFn(adminCancelFreight);
  const reopen = useServerFn(reopenFreight);
  const q = useQuery({ queryKey: ["freight-admin", id], queryFn: () => get({ data: { id } }) });
  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [refundType, setRefundType] = useState<"FULL"|"PARTIAL"|"NONE">("NONE");
  const [refundAmount, setRefundAmount] = useState("");

  const f = q.data?.freight;
  const job = q.data?.job;
  const pay = q.data?.payment;
  if (!f) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  const canReopen = f.status === "CLOSED" && job?.status === "SCHEDULED" && pay?.status !== "COMPLETED";
  const canCancel = f.status !== "CANCELLED" && f.status !== "CANCELLED_BY_CONTRACTOR" && (!job || job.status === "SCHEDULED");

  return (
    <div className="space-y-6">
      <Link to="/admin/freights" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
      <PageHeader
        title={f.title}
        subtitle={`${f.origin_city}/${f.origin_uf} → ${f.destination_city}/${f.destination_uf} · ${f.distance_km} km`}
        right={
          <div className="flex gap-2">
            {canReopen && <button onClick={() => setReopenOpen(true)} className="px-3 py-1.5 rounded-md border border-border text-sm">Reabrir</button>}
            {canCancel && <button onClick={() => setCancelOpen(true)} className="px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-sm font-semibold">Cancelar frete</button>}
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 lg:col-span-2">
          <h3 className="font-semibold text-sm mb-3">Dados do frete</h3>
          <dl className="text-sm grid grid-cols-2 gap-x-4 gap-y-1.5">
            <Row k="Empresa" v={f.contractors?.company_name} />
            <Row k="Status" v={f.status} />
            <Row k="Carga" v={`${f.cargo_type} · ${f.cargo_weight_kg}kg`} />
            <Row k="Veículos" v={(f.vehicle_types ?? []).join(", ") || "—"} />
            <Row k="Carroceria" v={(f.body_types ?? []).join(", ") || "—"} />
            <Row k="Coleta" v={formatDateTimeBR(f.pickup_at)} />
            <Row k="Entrega prevista" v={formatDateTimeBR(f.delivery_expected_at)} />
            <Row k="Anunciado" v={formatBRL(f.base_amount_in_cents)} />
            <Row k="Acordado" v={f.agreed_amount_in_cents ? formatBRL(f.agreed_amount_in_cents) : "—"} />
            <Row k="Pedágio incluso" v={f.toll_included ? "Sim" : "Não"} />
          </dl>
          {f.description && <p className="mt-3 text-sm text-muted-foreground">{f.description}</p>}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">Viagem / Pagamento</h3>
          {job ? (
            <div className="space-y-2 text-sm">
              <p><StatusBadge tone={job.status === "COMPLETED" ? "success" : job.status === "CANCELLED" ? "danger" : "primary"}>{job.status}</StatusBadge></p>
              <Link to="/admin/jobs/$id" params={{ id: job.id }} className="text-xs text-primary font-semibold">Ver viagem →</Link>
              {pay && <div className="text-xs mt-2">
                <p>Pagamento: <StatusBadge tone={pay.status === "COMPLETED" ? "primary" : pay.status === "RELEASED" ? "success" : pay.status === "REFUNDED" ? "danger" : "muted"}>{pay.status}</StatusBadge></p>
                <p className="text-sm font-bold mt-1">{formatBRL(pay.amount_in_cents)}</p>
              </div>}
            </div>
          ) : <p className="text-xs text-muted-foreground">Sem viagem vinculada.</p>}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Propostas ({q.data?.candidacies.length ?? 0})</h3>
        <DataTable
          rows={q.data?.candidacies ?? []}
          empty="Nenhuma proposta."
          columns={[
            { key: "m", header: "Motorista", render: (c: any) => <span className="text-sm">{c.providers?.full_name}</span> },
            { key: "v", header: "Veículo", render: (c: any) => <span className="text-xs">{c.vehicles?.vehicle_type} · {c.vehicles?.plate}</span> },
            { key: "va", header: "Valor", render: (c: any) => c.proposed_amount_in_cents ? formatBRL(c.proposed_amount_in_cents) : <span className="text-xs">Anunciado</span> },
            { key: "s", header: "Status", render: (c: any) => <StatusBadge tone={c.status === "ACCEPTED" ? "success" : c.status === "PENDING" ? "primary" : "muted"}>{c.status}</StatusBadge> },
            { key: "d", header: "Enviada", render: (c: any) => <span className="text-xs">{formatDateBR(c.created_at)}</span> },
          ]}
        />
      </div>

      <ConfirmModal open={cancelOpen} onClose={() => setCancelOpen(false)}
        title="Cancelar frete (admin)" tone="danger" confirmLabel="Cancelar frete" requireText="CANCELAR"
        onConfirm={async () => {
          if (reason.trim().length < 3) { toast.error("Motivo obrigatório"); throw new Error("motivo"); }
          await cancel({ data: { id, reason: reason.trim(), refund_type: refundType, refund_amount_reais: refundType === "PARTIAL" ? Number(refundAmount.replace(",", ".")) : undefined } });
          toast.success("Frete cancelado");
          qc.invalidateQueries({ queryKey: ["freight-admin", id] });
        }}>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo" rows={3}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
        {pay?.status === "COMPLETED" && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold">Estorno em custódia</p>
            {(["FULL","PARTIAL","NONE"] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input type="radio" checked={refundType === t} onChange={() => setRefundType(t)} />
                {t === "FULL" ? "Total ao embarcador" : t === "PARTIAL" ? "Parcial" : "Sem estorno"}
              </label>
            ))}
            {refundType === "PARTIAL" && (
              <input value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="Valor em reais" className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
            )}
          </div>
        )}
      </ConfirmModal>

      <ConfirmModal open={reopenOpen} onClose={() => setReopenOpen(false)}
        title="Reabrir frete" description="Desfaz o aceite; propostas voltam a pendente; viagem é excluída."
        confirmLabel="Reabrir" onConfirm={async () => {
          await reopen({ data: { id } });
          toast.success("Frete reaberto");
          qc.invalidateQueries({ queryKey: ["freight-admin", id] });
        }} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return <div><dt className="text-xs text-muted-foreground">{k}</dt><dd>{v}</dd></div>;
}
