import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdmins, createAdmin, setAdminActive } from "@/lib/admin.functions";
import { PageHeader, DataTable, StatusBadge, ConfirmModal } from "@/components/admin/ui";
import { formatDateBR } from "@/lib/format";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

export const Route = createFileRoute("/admin/team")({
  head: () => ({ meta: [{ title: "Equipe — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Team,
});

function Team() {
  const list = useServerFn(listAdmins);
  const create = useServerFn(createAdmin);
  const setActive = useServerFn(setAdminActive);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admins"], queryFn: () => list() });
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "ADMIN" as "ADMIN"|"SUPER_ADMIN", password: "" });
  const [toggle, setToggle] = useState<{ id: string; active: boolean } | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader title="Equipe" subtitle="Somente SUPER_ADMIN pode gerenciar" right={
        <button onClick={() => { setAddOpen(true); setForm({ email: "", name: "", role: "ADMIN", password: "" }); }} className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold">
          <UserPlus className="h-4 w-4" /> Adicionar admin
        </button>
      } />

      <DataTable
        rows={q.data ?? []}
        empty="Nenhum admin."
        columns={[
          { key: "n", header: "Nome", render: (a: any) => <span className="text-sm font-semibold">{a.name}</span> },
          { key: "e", header: "E-mail", render: (a: any) => <span className="text-xs">{a.email}</span> },
          { key: "r", header: "Papel", render: (a: any) => <StatusBadge tone={a.role === "SUPER_ADMIN" ? "primary" : "info"}>{a.role}</StatusBadge> },
          { key: "d", header: "Desde", render: (a: any) => <span className="text-xs">{formatDateBR(a.created_at)}</span> },
          { key: "s", header: "Status", render: (a: any) => a.is_active ? <StatusBadge tone="success">Ativo</StatusBadge> : <StatusBadge tone="muted">Desativado</StatusBadge> },
          { key: "act", header: "", render: (a: any) => (
            <button onClick={() => setToggle({ id: a.id, active: a.is_active })} className="px-2 py-1 rounded border border-border text-xs">
              {a.is_active ? "Desativar" : "Reativar"}
            </button>
          ) },
        ]}
      />

      <ConfirmModal open={addOpen} onClose={() => setAddOpen(false)}
        title="Novo admin" confirmLabel="Criar" tone="primary"
        onConfirm={async () => {
          await create({ data: form });
          toast.success("Admin criado");
          qc.invalidateQueries({ queryKey: ["admins"] });
        }}>
        <div className="space-y-3">
          <input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
          <input type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
          <input type="password" placeholder="Senha (mín. 8)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
            <option value="ADMIN">ADMIN</option><option value="SUPER_ADMIN">SUPER_ADMIN</option>
          </select>
        </div>
      </ConfirmModal>

      <ConfirmModal open={!!toggle} onClose={() => setToggle(null)}
        title={toggle?.active ? "Desativar admin" : "Reativar admin"} tone={toggle?.active ? "danger" : "primary"}
        onConfirm={async () => {
          await setActive({ data: { id: toggle!.id, is_active: !toggle!.active } });
          toast.success("Atualizado");
          qc.invalidateQueries({ queryKey: ["admins"] });
        }} />
    </div>
  );
}
