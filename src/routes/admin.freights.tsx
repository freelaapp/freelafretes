import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFreightsAdmin } from "@/lib/admin.functions";
import { PageHeader, DataTable, StatusBadge, Pagination, Tabs } from "@/components/admin/ui";
import { formatBRL, formatDateBR } from "@/lib/format";
import { UF_LIST, CARGO_TYPES } from "@/lib/constants";

export const Route = createFileRoute("/admin/freights")({
  head: () => ({ meta: [{ title: "Fretes — Admin" }, { name: "robots", content: "noindex" }] }),
  component: FreightsAdmin,
});

function FreightsAdmin() {
  const [tab, setTab] = useState<"OPEN"|"CLOSED"|"CANCELLED">("OPEN");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [ou, setOu] = useState(""); const [du, setDu] = useState(""); const [cargo, setCargo] = useState("");
  const fn = useServerFn(listFreightsAdmin);
  const q = useQuery({
    queryKey: ["freights-admin", tab, page, search, ou, du, cargo],
    queryFn: () => fn({ data: { tab, page, search: search || undefined, origin_uf: ou || undefined, dest_uf: du || undefined, cargo: cargo || undefined } }),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Fretes" subtitle="Todas as cargas publicadas na plataforma" />
      <Tabs value={tab} onChange={(v) => { setTab(v); setPage(1); }} tabs={[
        { value: "OPEN", label: "Abertos" }, { value: "CLOSED", label: "Fechados" }, { value: "CANCELLED", label: "Cancelados" },
      ]} />

      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Título ou cidade" className="flex-1 min-w-64 rounded-md border border-border px-3 py-2 text-sm bg-card" />
        <select value={ou} onChange={(e) => { setOu(e.target.value); setPage(1); }} className="rounded-md border border-border px-3 py-2 text-sm bg-card">
          <option value="">Origem</option>{UF_LIST.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={du} onChange={(e) => { setDu(e.target.value); setPage(1); }} className="rounded-md border border-border px-3 py-2 text-sm bg-card">
          <option value="">Destino</option>{UF_LIST.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={cargo} onChange={(e) => { setCargo(e.target.value); setPage(1); }} className="rounded-md border border-border px-3 py-2 text-sm bg-card">
          <option value="">Carga</option>{CARGO_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <DataTable
        rows={q.data?.rows ?? []}
        empty="Nenhum frete."
        columns={[
          { key: "r", header: "Rota", render: (f: any) => (
            <Link to="/admin/freights/$id" params={{ id: f.id }} className="block">
              <p className="font-semibold text-sm">{f.origin_city}/{f.origin_uf} → {f.destination_city}/{f.destination_uf}</p>
              <p className="text-xs text-muted-foreground truncate max-w-xs">{f.title}</p>
            </Link>
          ) },
          { key: "e", header: "Empresa", render: (f: any) => <span className="text-xs">{f.contractors?.company_name}</span> },
          { key: "m", header: "Modo", render: (f: any) => modeBadge(f.freight_mode) },
          { key: "c", header: "Carga", render: (f: any) => <span className="text-xs">{f.cargo_type} · {f.cargo_weight_kg}kg</span> },
          { key: "va", header: "Anunciado", render: (f: any) => <span className="text-sm font-semibold">{formatBRL(f.base_amount_in_cents)}</span> },
          { key: "vg", header: "Acordado", render: (f: any) => f.agreed_amount_in_cents ? <span className="text-sm text-primary font-semibold">{formatBRL(f.agreed_amount_in_cents)}</span> : <span className="text-xs text-muted-foreground">—</span> },
          { key: "pr", header: "Propostas", render: (f: any) => <StatusBadge tone="info">{f.proposals_count}</StatusBadge> },
          { key: "d", header: "Coleta", render: (f: any) => <span className="text-xs">{formatDateBR(f.pickup_at)}</span> },
          { key: "s", header: "Status", render: (f: any) => statusBadge(f.status) },
        ]}
      />
      <Pagination page={page} total={q.data?.total ?? 0} onChange={setPage} />
    </div>
  );
}

function statusBadge(s: string) {
  if (s === "OPEN") return <StatusBadge tone="primary">Aberto</StatusBadge>;
  if (s === "CLOSED") return <StatusBadge tone="success">Fechado</StatusBadge>;
  return <StatusBadge tone="muted">Cancelado</StatusBadge>;
}
