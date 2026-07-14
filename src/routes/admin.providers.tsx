import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProvidersAdmin } from "@/lib/admin.functions";
import { PageHeader, DataTable, StatusBadge, Pagination } from "@/components/admin/ui";
import { formatDateBR } from "@/lib/format";
import { UF_LIST, CNH_CATEGORIES } from "@/lib/constants";

export const Route = createFileRoute("/admin/providers")({
  head: () => ({ meta: [{ title: "Motoristas — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Providers,
});

function maskCpf(cpf: string | null) {
  if (!cpf) return "-";
  const d = cpf.replace(/\D/g, "");
  return `${d.slice(0,3)}.***.***-${d.slice(-2)}`;
}

function Providers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [uf, setUf] = useState("");
  const [cnh, setCnh] = useState("");
  const [active, setActive] = useState<"all"|"active"|"inactive">("all");
  const [expired, setExpired] = useState(false);
  const fn = useServerFn(listProvidersAdmin);
  const q = useQuery({
    queryKey: ["providers-admin", page, search, uf, cnh, active, expired],
    queryFn: () => fn({ data: { page, search: search || undefined, uf: uf || undefined, cnh: cnh || undefined, active, cnh_expired: expired } }),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Motoristas" subtitle="Todos os caminhoneiros cadastrados" />
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Nome, CPF, e-mail" className="flex-1 min-w-64 rounded-md border border-border px-3 py-2 text-sm bg-card" />
        <select value={uf} onChange={(e) => { setUf(e.target.value); setPage(1); }} className="rounded-md border border-border px-3 py-2 text-sm bg-card">
          <option value="">UF</option>{UF_LIST.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={cnh} onChange={(e) => { setCnh(e.target.value); setPage(1); }} className="rounded-md border border-border px-3 py-2 text-sm bg-card">
          <option value="">CNH</option>{CNH_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={active} onChange={(e) => { setActive(e.target.value as any); setPage(1); }} className="rounded-md border border-border px-3 py-2 text-sm bg-card">
          <option value="all">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option>
        </select>
        <label className="flex items-center gap-2 text-xs px-3 py-2 border border-border rounded-md bg-card cursor-pointer">
          <input type="checkbox" checked={expired} onChange={(e) => { setExpired(e.target.checked); setPage(1); }} /> CNH vencida
        </label>
      </div>

      <DataTable
        rows={q.data?.rows ?? []}
        empty="Nenhum motorista encontrado."
        columns={[
          { key: "n", header: "Motorista", render: (p: any) => (
            <Link to="/admin/providers/$id" params={{ id: p.id }} className="block">
              <p className="font-semibold text-sm">{p.full_name}</p>
              <p className="text-xs text-muted-foreground">{p.email}</p>
            </Link>
          ) },
          { key: "cpf", header: "CPF", render: (p: any) => <span className="text-sm font-mono">{maskCpf(p.cpf)}</span> },
          { key: "loc", header: "Local", render: (p: any) => <span className="text-xs">{p.city ?? "-"}/{p.uf ?? "-"}</span> },
          { key: "cnh", header: "CNH", render: (p: any) => {
            const exp = p.cnh_expires_at ? new Date(p.cnh_expires_at) : null;
            const expired = exp && exp < new Date();
            return <div className="text-xs">
              <p>{p.cnh_category} · {formatDateBR(p.cnh_expires_at)}</p>
              {expired && <StatusBadge tone="danger">Vencida</StatusBadge>}
            </div>;
          } },
          { key: "s", header: "Status", render: (p: any) => p.is_banned ? <StatusBadge tone="danger">Banido</StatusBadge> : p.is_active ? <StatusBadge tone="success">Ativo</StatusBadge> : <StatusBadge tone="muted">Inativo</StatusBadge> },
        ]}
      />
      <Pagination page={page} total={q.data?.total ?? 0} onChange={setPage} />
    </div>
  );
}
