import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listContractorsAdmin } from "@/lib/admin.functions";
import { PageHeader, DataTable, StatusBadge, Pagination } from "@/components/admin/ui";
import { formatDateBR } from "@/lib/format";
import { UF_LIST } from "@/lib/constants";

export const Route = createFileRoute("/admin/contractors")({
  head: () => ({ meta: [{ title: "Empresas — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Contractors,
});

function Contractors() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [validation, setValidation] = useState("");
  const [uf, setUf] = useState("");
  const [active, setActive] = useState<"all"|"active"|"inactive">("all");
  const fn = useServerFn(listContractorsAdmin);
  const q = useQuery({
    queryKey: ["contractors-admin", page, search, validation, uf, active],
    queryFn: () => fn({ data: { page, search: search || undefined, validation: validation || undefined, uf: uf || undefined, active } }),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Empresas" subtitle="Todos os embarcadores cadastrados na plataforma" />
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar razão social, CNPJ ou e-mail" className="flex-1 min-w-64 rounded-md border border-border px-3 py-2 text-sm bg-card" />
        <select value={validation} onChange={(e) => { setValidation(e.target.value); setPage(1); }} className="rounded-md border border-border px-3 py-2 text-sm bg-card">
          <option value="">Toda validação</option>
          <option value="PENDING_VALIDATION">Pendente</option>
          <option value="APPROVED">Aprovada</option>
          <option value="REJECTED">Recusada</option>
        </select>
        <select value={uf} onChange={(e) => { setUf(e.target.value); setPage(1); }} className="rounded-md border border-border px-3 py-2 text-sm bg-card">
          <option value="">Todos os UFs</option>
          {UF_LIST.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={active} onChange={(e) => { setActive(e.target.value as any); setPage(1); }} className="rounded-md border border-border px-3 py-2 text-sm bg-card">
          <option value="all">Todas</option><option value="active">Ativas</option><option value="inactive">Inativas</option>
        </select>
      </div>

      <DataTable
        rows={q.data?.rows ?? []}
        empty="Nenhuma empresa encontrada."
        columns={[
          { key: "co", header: "Empresa", render: (c: any) => (
            <Link to="/admin/contractors/$id" params={{ id: c.id }} className="block">
              <p className="font-semibold text-sm text-foreground">{c.company_name}</p>
              <p className="text-xs text-muted-foreground">{c.corporate_reason}</p>
            </Link>
          ) },
          { key: "cnpj", header: "CNPJ", render: (c: any) => <span className="text-sm">{c.cnpj}</span> },
          { key: "loc", header: "Localização", render: (c: any) => <span className="text-xs">{c.city ?? "-"}/{c.uf ?? "-"}</span> },
          { key: "val", header: "Validação", render: (c: any) => (
            c.validation_status === "APPROVED" ? <StatusBadge tone="success">Aprovada</StatusBadge> :
            c.validation_status === "REJECTED" ? <StatusBadge tone="danger">Recusada</StatusBadge> :
            <StatusBadge tone="warning">Pendente</StatusBadge>
          ) },
          { key: "cad", header: "Cadastro", render: (c: any) => <span className="text-xs">{formatDateBR(c.created_at)}</span> },
          { key: "st", header: "Status", render: (c: any) => c.is_active ? <StatusBadge tone="success">Ativa</StatusBadge> : <StatusBadge tone="muted">Inativa</StatusBadge> },
        ]}
      />
      <Pagination page={page} total={q.data?.total ?? 0} onChange={setPage} />
    </div>
  );
}
