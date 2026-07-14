import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listValidationQueue, approveContractor, rejectContractor } from "@/lib/admin.functions";
import { PageHeader, DataTable, Tabs, ConfirmModal, StatusBadge } from "@/components/admin/ui";
import { formatDateBR } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/validation")({
  head: () => ({ meta: [{ title: "Validação de Empresas — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Validation,
});

function Validation() {
  const [tab, setTab] = useState<"PENDING_VALIDATION"|"APPROVED"|"REJECTED">("PENDING_VALIDATION");
  const [search, setSearch] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const qc = useQueryClient();
  const list = useServerFn(listValidationQueue);
  const approve = useServerFn(approveContractor);
  const reject = useServerFn(rejectContractor);
  const q = useQuery({ queryKey: ["validation", tab, search], queryFn: () => list({ data: { tab, search: search || undefined } }) });

  function refresh() { qc.invalidateQueries({ queryKey: ["validation"] }); qc.invalidateQueries({ queryKey: ["admin-validation-count"] }); qc.invalidateQueries({ queryKey: ["admin-dashboard"] }); }

  return (
    <div className="space-y-5">
      <PageHeader title="Validação de Empresas" subtitle="Aprove ou recuse cadastros de embarcadores" />

      <div className="flex items-end justify-between gap-3">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: "PENDING_VALIDATION", label: "Pendentes" },
          { value: "APPROVED", label: "Aprovadas" },
          { value: "REJECTED", label: "Recusadas" },
        ]} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por CNPJ ou razão social"
          className="w-72 rounded-md border border-border px-3 py-2 text-sm bg-card" />
      </div>

      <DataTable
        rows={q.data ?? []}
        empty="Nenhuma empresa nesta aba."
        columns={[
          { key: "co", header: "Empresa", render: (c: any) => (
            <div>
              <p className="font-semibold text-sm">{c.company_name}</p>
              <p className="text-xs text-muted-foreground">{c.corporate_reason}</p>
            </div>
          ) },
          { key: "cnpj", header: "CNPJ", render: (c: any) => <span className="text-sm">{c.cnpj}</span> },
          { key: "seg", header: "Ramo", render: (c: any) => <span className="text-xs">{c.segment}</span> },
          { key: "vol", header: "Volume/mês", render: (c: any) => <span className="text-xs">{c.monthly_freight_volume}</span> },
          { key: "resp", header: "Responsável", render: (c: any) => (
            <div className="text-xs">
              <p>{c.contact_name} {c.is_company_partner && <StatusBadge tone="info">sócio</StatusBadge>}</p>
              <p className="text-muted-foreground">{c.contact_email} · {c.contact_phone}</p>
            </div>
          ) },
          { key: "date", header: "Cadastro", render: (c: any) => {
            const days = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
            return <div className="text-xs"><p>{formatDateBR(c.created_at)}</p><p className="text-muted-foreground">há {days}d</p></div>;
          } },
          { key: "act", header: "", render: (c: any) => tab === "PENDING_VALIDATION" ? (
            <div className="flex gap-2 justify-end">
              <button onClick={() => setApprovingId(c.id)} className="px-3 py-1.5 rounded-md bg-success text-success-foreground text-xs font-semibold">Aprovar</button>
              <button onClick={() => { setRejectingId(c.id); setRejectReason(""); }} className="px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-xs font-semibold">Recusar</button>
            </div>
          ) : tab === "REJECTED" ? (
            <span className="text-xs text-muted-foreground italic max-w-xs block truncate">{c.validation_notes}</span>
          ) : (
            <span className="text-xs text-muted-foreground">{formatDateBR(c.validated_at)}</span>
          ) },
        ]}
      />

      <ConfirmModal
        open={!!approvingId}
        onClose={() => setApprovingId(null)}
        title="Aprovar empresa"
        description="A empresa passará a exibir o selo Verificada."
        confirmLabel="Aprovar"
        onConfirm={async () => {
          await approve({ data: { id: approvingId! } });
          toast.success("Empresa aprovada");
          refresh();
        }}
      />
      <ConfirmModal
        open={!!rejectingId}
        onClose={() => setRejectingId(null)}
        title="Recusar cadastro"
        description="Informe o motivo. A empresa poderá corrigir e reenviar."
        confirmLabel="Recusar"
        tone="danger"
        onConfirm={async () => {
          if (!rejectReason.trim() || rejectReason.trim().length < 3) { toast.error("Informe um motivo válido"); throw new Error("motivo curto"); }
          await reject({ data: { id: rejectingId!, reason: rejectReason.trim() } });
          toast.success("Cadastro recusado");
          refresh();
        }}
      >
        <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Motivo da recusa" rows={4}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
      </ConfirmModal>
    </div>
  );
}
