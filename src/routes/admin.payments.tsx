import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPaymentsAdmin, paymentsSummary, releasePayment, refundPayment } from "@/lib/admin.functions";
import { PageHeader, DataTable, StatusBadge, Pagination, KpiCard, ConfirmModal } from "@/components/admin/ui";
import { formatBRL, formatDateBR } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({ meta: [{ title: "Pagamentos — Admin" }, { name: "robots", content: "noindex" }] }),
  component: PaymentsAdmin,
});

function PaymentsAdmin() {
  const [status, setStatus] = useState<"ALL"|"PENDING"|"HELD"|"COMPLETED"|"RELEASED"|"REFUNDED">("ALL");
  const [page, setPage] = useState(1);
  const list = useServerFn(listPaymentsAdmin);
  const summary = useServerFn(paymentsSummary);
  const release = useServerFn(releasePayment);
  const refund = useServerFn(refundPayment);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["payments-admin", status, page], queryFn: () => list({ data: { status, page } }) });
  const s = useQuery({ queryKey: ["payments-summary"], queryFn: () => summary() });

  const [releaseId, setReleaseId] = useState<string | null>(null);
  const [refundId, setRefundId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");

  return (
    <div className="space-y-5">
      <PageHeader title="Pagamentos" subtitle="Todos os pagamentos processados na plataforma" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard label="Em custódia" value={formatBRL(s.data?.escrowCents ?? 0)} />
        <KpiCard label="Liberado no mês" value={formatBRL(s.data?.releasedMonthCents ?? 0)} tone="success" />
        <KpiCard label="Estornado no mês" value={formatBRL(s.data?.refundedMonthCents ?? 0)} />
      </div>

      <div className="flex gap-2">
        <select value={status} onChange={(e) => { setStatus(e.target.value as any); setPage(1); }} className="rounded-md border border-border px-3 py-2 text-sm bg-card">
          <option value="ALL">Todos</option>
          <option value="PENDING">Pendente</option>
          <option value="HELD">Em custódia (HELD)</option>
          <option value="COMPLETED">Em custódia (legado)</option>
          <option value="RELEASED">Liberado</option>
          <option value="REFUNDED">Estornado</option>
        </select>
      </div>

      <DataTable
        rows={q.data?.rows ?? []}
        empty="Nenhum pagamento."
        columns={[
          { key: "r", header: "Viagem", render: (p: any) => (
            <div className="text-xs">
              <p className="font-semibold">{p.jobs?.freights?.origin_city}/{p.jobs?.freights?.origin_uf} → {p.jobs?.freights?.destination_city}/{p.jobs?.freights?.destination_uf}</p>
            </div>
          ) },
          { key: "e", header: "Empresa", render: (p: any) => <span className="text-xs">{p.jobs?.contractors?.company_name}</span> },
          { key: "m", header: "Motorista", render: (p: any) => <span className="text-xs">{p.jobs?.providers?.full_name}</span> },
          { key: "v", header: "Valor", render: (p: any) => <span className="text-sm font-semibold">{formatBRL(p.amount_in_cents)}</span> },
          { key: "f", header: "Taxa (10%)", render: (p: any) => <span className="text-xs">{formatBRL(p.service_fee_in_cents)}</span> },
          { key: "l", header: "Motorista recebe", render: (p: any) => <span className="text-xs">{formatBRL(p.amount_in_cents - p.service_fee_in_cents)}</span> },
          { key: "s", header: "Status", render: (p: any) => paymentBadge(p.status) },
          { key: "d", header: "Data", render: (p: any) => <span className="text-xs">{formatDateBR(p.paid_at ?? p.created_at)}</span> },
          { key: "a", header: "", render: (p: any) => (
            <div className="flex gap-1 justify-end">
              {p.status === "COMPLETED" && <button onClick={() => setReleaseId(p.id)} className="px-2 py-1 rounded bg-success/20 text-success text-xs font-semibold">Liberar</button>}
              {(p.status === "PENDING" || p.status === "COMPLETED") && <button onClick={() => { setRefundId(p.id); setRefundReason(""); }} className="px-2 py-1 rounded bg-destructive/20 text-destructive text-xs font-semibold">Estornar</button>}
            </div>
          ) },
        ]}
      />
      <Pagination page={page} total={q.data?.total ?? 0} onChange={setPage} />

      <ConfirmModal open={!!releaseId} onClose={() => setReleaseId(null)}
        title="Liberar pagamento" description="O valor será liberado ao motorista." tone="primary" confirmLabel="Liberar" requireText="LIBERAR"
        onConfirm={async () => {
          await release({ data: { id: releaseId! } });
          toast.success("Pagamento liberado");
          qc.invalidateQueries({ queryKey: ["payments-admin"] });
          qc.invalidateQueries({ queryKey: ["payments-summary"] });
        }} />

      <ConfirmModal open={!!refundId} onClose={() => setRefundId(null)}
        title="Estornar pagamento" tone="danger" confirmLabel="Estornar" requireText="ESTORNAR"
        onConfirm={async () => {
          if (refundReason.trim().length < 3) { toast.error("Motivo obrigatório"); throw new Error("motivo"); }
          await refund({ data: { id: refundId!, reason: refundReason.trim() } });
          toast.success("Pagamento estornado");
          qc.invalidateQueries({ queryKey: ["payments-admin"] });
          qc.invalidateQueries({ queryKey: ["payments-summary"] });
        }}>
        <textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Motivo do estorno" rows={3} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
      </ConfirmModal>
    </div>
  );
}

function paymentBadge(s?: string) {
  if (s === "PENDING") return <StatusBadge tone="warning">Aguardando</StatusBadge>;
  if (s === "COMPLETED") return <StatusBadge tone="primary">🔒 Custódia</StatusBadge>;
  if (s === "RELEASED") return <StatusBadge tone="success">✓ Liberado</StatusBadge>;
  if (s === "REFUNDED") return <StatusBadge tone="danger">Estornado</StatusBadge>;
  return <StatusBadge tone="muted">{s}</StatusBadge>;
}
