import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getContractorAdmin, setContractorActive } from "@/lib/admin.functions";
import { PageHeader, StatusBadge, ConfirmModal, DataTable } from "@/components/admin/ui";
import { formatBRL, formatDateBR } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin/contractors/$id")({
  head: () => ({ meta: [{ title: "Empresa — Admin" }, { name: "robots", content: "noindex" }] }),
  component: ContractorDetail,
});

function ContractorDetail() {
  const { id } = Route.useParams();
  const get = useServerFn(getContractorAdmin);
  const setActive = useServerFn(setContractorActive);
  const q = useQuery({ queryKey: ["contractor-admin", id], queryFn: () => get({ data: { id } }) });
  const qc = useQueryClient();
  const [toggleOpen, setToggleOpen] = useState(false);
  const c = q.data?.contractor;

  if (!c) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <Link to="/admin/contractors" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
      <PageHeader
        title={c.company_name}
        subtitle={`${c.corporate_reason} · CNPJ ${c.cnpj}`}
        right={
          <div className="flex items-center gap-2">
            {c.validation_status === "APPROVED" && <StatusBadge tone="success">Verificada</StatusBadge>}
            {c.validation_status === "REJECTED" && <StatusBadge tone="danger">Recusada</StatusBadge>}
            {c.validation_status === "PENDING_VALIDATION" && <StatusBadge tone="warning">Pendente</StatusBadge>}
            <button onClick={() => setToggleOpen(true)} className="px-3 py-1.5 rounded-md border border-border text-sm">
              {c.is_active ? "Desativar" : "Reativar"} conta
            </button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">Dados cadastrais</h3>
          <dl className="text-sm space-y-1.5">
            <Row k="CPF resp." v={c.cpf} />
            <Row k="Sócio?" v={c.is_company_partner ? "Sim" : "Não"} />
            <Row k="Segmento" v={c.segment} />
            <Row k="Volume/mês" v={c.monthly_freight_volume} />
            <Row k="Cidade/UF" v={`${c.city ?? "-"}/${c.uf ?? "-"}`} />
            <Row k="Contato" v={c.contact_name} />
            <Row k="E-mail" v={c.contact_email} />
            <Row k="Telefone" v={c.contact_phone} />
            <Row k="Cadastrada em" v={formatDateBR(c.created_at)} />
            {c.validated_at && <Row k="Validada em" v={formatDateBR(c.validated_at)} />}
            {c.validation_notes && <Row k="Motivo recusa" v={c.validation_notes} />}
          </dl>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">Fretes ({q.data?.freights.length ?? 0})</h3>
          <ul className="space-y-2 text-sm max-h-96 overflow-y-auto">
            {(q.data?.freights ?? []).map((f: any) => (
              <li key={f.id} className="border-b border-border pb-2">
                <Link to="/admin/freights/$id" params={{ id: f.id }} className="font-medium text-primary text-xs">{f.title}</Link>
                <p className="text-xs text-muted-foreground">{f.origin_city}/{f.origin_uf} → {f.destination_city}/{f.destination_uf} · {f.status}</p>
              </li>
            ))}
            {(q.data?.freights ?? []).length === 0 && <li className="text-xs text-muted-foreground">Nenhum frete.</li>}
          </ul>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">Pagamentos</h3>
          <p className="text-2xl font-bold">{formatBRL((q.data?.payments ?? []).filter((p: any) => p.status !== "REFUNDED").reduce((a: number, p: any) => a + p.amount_in_cents, 0))}</p>
          <p className="text-xs text-muted-foreground">Total pago em custódia + liberados</p>
          <div className="mt-3 space-y-1 text-xs max-h-64 overflow-y-auto">
            {(q.data?.payments ?? []).map((p: any) => (
              <div key={p.id} className="flex justify-between border-b border-border py-1">
                <span>{formatDateBR(p.created_at)}</span>
                <span>{formatBRL(p.amount_in_cents)}</span>
                <StatusBadge tone={p.status === "REFUNDED" ? "danger" : p.status === "RELEASED" ? "success" : "primary"}>{p.status}</StatusBadge>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Avaliações recebidas</h3>
        <DataTable
          rows={q.data?.feedbacks ?? []}
          empty="Sem avaliações."
          columns={[
            { key: "d", header: "Data", render: (f: any) => <span className="text-xs">{formatDateBR(f.created_at)}</span> },
            { key: "r", header: "Nota", render: (f: any) => <span className="font-bold">{f.rating}★</span> },
            { key: "c", header: "Comentário", render: (f: any) => <span className="text-xs">{f.comment ?? "—"}</span> },
            { key: "h", header: "", render: (f: any) => f.hidden && <StatusBadge tone="muted">Oculta</StatusBadge> },
          ]}
        />
      </div>

      <ConfirmModal
        open={toggleOpen}
        onClose={() => setToggleOpen(false)}
        title={c.is_active ? "Desativar empresa" : "Reativar empresa"}
        description={c.is_active ? "A empresa não poderá publicar novos fretes." : "A empresa poderá voltar a publicar fretes."}
        confirmLabel={c.is_active ? "Desativar" : "Reativar"}
        tone={c.is_active ? "danger" : "primary"}
        onConfirm={async () => {
          await setActive({ data: { id: c.id, is_active: !c.is_active } });
          toast.success("Atualizado");
          qc.invalidateQueries({ queryKey: ["contractor-admin", id] });
        }}
      />
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right">{v}</dd></div>;
}
