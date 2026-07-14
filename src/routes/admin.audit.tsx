import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAuditLogs } from "@/lib/admin.functions";
import { PageHeader, DataTable, StatusBadge, Pagination } from "@/components/admin/ui";
import { formatDateTimeBR } from "@/lib/format";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({ meta: [{ title: "Auditoria — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Audit,
});

function Audit() {
  const [action, setAction] = useState("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const fn = useServerFn(listAuditLogs);
  const q = useQuery({
    queryKey: ["audit", action, from, to, page],
    queryFn: () => fn({ data: { action: action || undefined, from: from ? new Date(from).toISOString() : undefined, to: to ? new Date(to).toISOString() : undefined, page } }),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Auditoria" subtitle="Histórico de todas as ações administrativas" />
      <div className="flex flex-wrap gap-2">
        <input value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} placeholder="Ação (ex.: BAN_PROVIDER)" className="flex-1 min-w-64 rounded-md border border-border px-3 py-2 text-sm bg-card" />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-border px-3 py-2 text-sm bg-card" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-border px-3 py-2 text-sm bg-card" />
      </div>

      <DataTable
        rows={q.data?.rows ?? []}
        empty="Sem registros."
        columns={[
          { key: "d", header: "Data", render: (l: any) => <span className="text-xs">{formatDateTimeBR(l.created_at)}</span> },
          { key: "a", header: "Admin", render: (l: any) => <span className="text-xs">{l.admins?.name}<br /><span className="text-muted-foreground">{l.admins?.email}</span></span> },
          { key: "ac", header: "Ação", render: (l: any) => <StatusBadge tone="primary">{l.action}</StatusBadge> },
          { key: "e", header: "Entidade", render: (l: any) => <span className="text-xs">{l.entity_type}{l.entity_id ? ` · ${l.entity_id.slice(0, 8)}` : ""}</span> },
          { key: "det", header: "Detalhes", render: (l: any) => <pre className="text-[10px] max-w-md overflow-hidden">{Object.keys(l.details ?? {}).length ? JSON.stringify(l.details) : "—"}</pre> },
        ]}
      />
      <Pagination page={page} total={q.data?.total ?? 0} onChange={setPage} />
    </div>
  );
}
