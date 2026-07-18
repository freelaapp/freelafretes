import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listJobsAdmin } from "@/lib/admin.functions";
import { PageHeader, DataTable, StatusBadge, Pagination, Tabs } from "@/components/admin/ui";
import { formatBRL, formatDateBR } from "@/lib/format";

export const Route = createFileRoute("/admin/jobs")({
  head: () => ({ meta: [{ title: "Viagens — Admin" }, { name: "robots", content: "noindex" }] }),
  component: JobsAdmin,
});

function JobsAdmin() {
  const [tab, setTab] = useState<"SCHEDULED"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED">("SCHEDULED");
  const [page, setPage] = useState(1);
  const fn = useServerFn(listJobsAdmin);
  const q = useQuery({ queryKey: ["jobs-admin", tab, page], queryFn: () => fn({ data: { tab, page } }) });

  return (
    <div className="space-y-5">
      <PageHeader title="Viagens" subtitle="Todas as viagens contratadas" />
      <Tabs value={tab} onChange={(v) => { setTab(v); setPage(1); }} tabs={[
        { value: "SCHEDULED", label: "Agendadas" }, { value: "IN_PROGRESS", label: "Em andamento" },
        { value: "COMPLETED", label: "Concluídas" }, { value: "CANCELLED", label: "Canceladas" },
      ]} />

      <DataTable
        rows={q.data?.rows ?? []}
        empty="Nenhuma viagem."
        columns={[
          { key: "r", header: "Rota", render: (j: any) => (
            <Link to="/admin/jobs/$id" params={{ id: j.id }} className="block">
              <p className="font-semibold text-sm">{j.freights?.origin_city}/{j.freights?.origin_uf} → {j.freights?.destination_city}/{j.freights?.destination_uf}</p>
              <p className="text-xs text-muted-foreground truncate max-w-xs">{j.freights?.title}</p>
            </Link>
          ) },
          { key: "e", header: "Empresa", render: (j: any) => <span className="text-xs">{j.contractors?.company_name}</span> },
          { key: "mo", header: "Modo", render: (j: any) => modeBadge(j.freights?.freight_mode) },
          { key: "m", header: "Motorista", render: (j: any) => <span className="text-xs">{j.providers?.full_name}</span> },
          { key: "v", header: "Valor", render: (j: any) => <span className="text-sm font-semibold">{formatBRL(j.agreed_amount_in_cents)}</span> },
          { key: "p", header: "Pagamento", render: (j: any) => paymentBadge(j.payments?.[0]?.status) },
          { key: "c", header: "Coleta", render: (j: any) => <span className="text-xs">{formatDateBR(j.freights?.pickup_at)}</span> },
          { key: "d", header: "Iniciada", render: (j: any) => <span className="text-xs">{formatDateBR(j.started_at)}</span> },
          { key: "dsp", header: "", render: (j: any) => j.disputed && <StatusBadge tone="danger">Em disputa</StatusBadge> },
        ]}
      />
      <Pagination page={page} total={q.data?.total ?? 0} onChange={setPage} />
    </div>
  );
}

function paymentBadge(s?: string) {
  if (!s) return <StatusBadge tone="muted">—</StatusBadge>;
  if (s === "PENDING") return <StatusBadge tone="warning">Aguardando</StatusBadge>;
  if (s === "COMPLETED") return <StatusBadge tone="primary">🔒 Custódia</StatusBadge>;
  if (s === "RELEASED") return <StatusBadge tone="success">✓ Liberado</StatusBadge>;
  if (s === "REFUNDED") return <StatusBadge tone="danger">Estornado</StatusBadge>;
  return <StatusBadge tone="muted">{s}</StatusBadge>;
}
