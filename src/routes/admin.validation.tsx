import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listValidationQueue, approveContractor, rejectContractor,
  listProviderValidationQueue, approveProviderValidation, rejectProviderValidation,
  adminSignDriverDocUrl,
} from "@/lib/admin.functions";
import { PageHeader, DataTable, Tabs, ConfirmModal, StatusBadge } from "@/components/admin/ui";
import { formatDateBR } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/validation")({
  head: () => ({ meta: [{ title: "Validação — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Validation,
});

type StatusTab = "PENDING_VALIDATION" | "APPROVED" | "REJECTED";

function Validation() {
  const [outer, setOuter] = useState<"contractors" | "providers">("contractors");
  return (
    <div className="space-y-5">
      <PageHeader title="Validação" subtitle="Aprove ou recuse cadastros de embarcadores e motoristas" />
      <Tabs value={outer} onChange={setOuter} tabs={[
        { value: "contractors", label: "Empresas" },
        { value: "providers", label: "Motoristas" },
      ]} />
      {outer === "contractors" ? <ContractorQueue /> : <ProviderQueue />}
    </div>
  );
}

function ContractorQueue() {
  const [tab, setTab] = useState<StatusTab>("PENDING_VALIDATION");
  const [search, setSearch] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const qc = useQueryClient();
  const list = useServerFn(listValidationQueue);
  const approve = useServerFn(approveContractor);
  const reject = useServerFn(rejectContractor);
  const q = useQuery({ queryKey: ["validation-contractors", tab, search], queryFn: () => list({ data: { tab, search: search || undefined } }) });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["validation-contractors"] });
    qc.invalidateQueries({ queryKey: ["admin-validation-count"] });
    qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
  }

  return (
    <div className="space-y-3">
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
        open={!!approvingId} onClose={() => setApprovingId(null)}
        title="Aprovar empresa" description="A empresa passará a exibir o selo Verificada."
        confirmLabel="Aprovar"
        onConfirm={async () => { await approve({ data: { id: approvingId! } }); toast.success("Empresa aprovada"); refresh(); }}
      />
      <ConfirmModal
        open={!!rejectingId} onClose={() => setRejectingId(null)}
        title="Recusar cadastro" description="Informe o motivo. A empresa poderá corrigir e reenviar."
        confirmLabel="Recusar" tone="danger"
        onConfirm={async () => {
          if (rejectReason.trim().length < 3) { toast.error("Informe um motivo válido"); throw new Error("motivo curto"); }
          await reject({ data: { id: rejectingId!, reason: rejectReason.trim() } });
          toast.success("Cadastro recusado"); refresh();
        }}
      >
        <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Motivo da recusa" rows={4}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
      </ConfirmModal>
    </div>
  );
}

function maskCpfMask(cpf: string) {
  const c = (cpf || "").replace(/\D/g, "").padStart(11, "0");
  return `${c.slice(0,3)}.***.***-${c.slice(-2)}`;
}

function ProviderQueue() {
  const [tab, setTab] = useState<StatusTab>("PENDING_VALIDATION");
  const [search, setSearch] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const qc = useQueryClient();
  const list = useServerFn(listProviderValidationQueue);
  const approve = useServerFn(approveProviderValidation);
  const reject = useServerFn(rejectProviderValidation);
  const sign = useServerFn(adminSignDriverDocUrl);
  const q = useQuery({ queryKey: ["validation-providers", tab, search], queryFn: () => list({ data: { tab, search: search || undefined } }) });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["validation-providers"] });
    qc.invalidateQueries({ queryKey: ["admin-validation-count"] });
  }

  async function openDoc(path?: string | null) {
    if (!path) return toast.error("Documento ausente");
    try {
      const { url } = await sign({ data: { path } });
      window.open(url, "_blank", "noopener");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: "PENDING_VALIDATION", label: "Pendentes" },
          { value: "APPROVED", label: "Aprovados" },
          { value: "REJECTED", label: "Recusados" },
        ]} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, CPF ou e-mail"
          className="w-72 rounded-md border border-border px-3 py-2 text-sm bg-card" />
      </div>

      <DataTable
        rows={q.data ?? []}
        empty="Nenhum motorista nesta aba."
        columns={[
          { key: "who", header: "Motorista", render: (p: any) => (
            <div>
              <p className="font-semibold text-sm">{p.full_name}</p>
              <p className="text-xs text-muted-foreground">{p.email} · {p.phone}</p>
              <p className="text-[11px] text-muted-foreground">CPF: {maskCpfMask(p.cpf)}</p>
            </div>
          ) },
          { key: "cnh", header: "CNH", render: (p: any) => (
            <div className="text-xs">
              <p>Cat <b>{p.cnh_category}</b></p>
              <p className="text-muted-foreground">Val {formatDateBR(p.cnh_expires_at)}</p>
              <p className="text-muted-foreground">Nº {p.cnh_number}</p>
            </div>
          ) },
          { key: "docs", header: "Documentos", render: (p: any) => (
            <div className="flex flex-col gap-1 text-xs">
              <button onClick={() => openDoc(p.cnh_document_url)} className="text-primary hover:underline text-left">CNH frente</button>
              <button onClick={() => openDoc(p.cnh_back_url)} className="text-primary hover:underline text-left">CNH verso</button>
              <button onClick={() => openDoc(p.address_proof_url)} className="text-primary hover:underline text-left">Comprovante residência</button>
              {p.selfie_url && <button onClick={() => openDoc(p.selfie_url)} className="text-primary hover:underline text-left">Selfie</button>}
            </div>
          ) },
          { key: "veh", header: "Veículos", render: (p: any) => (
            <div className="text-xs space-y-0.5">
              {(p.vehicles ?? []).map((v: any) => (
                <p key={v.id}>{v.vehicle_type} · {v.body_type} · {v.plate} · {v.capacity_kg}kg</p>
              ))}
              {(p.vehicles ?? []).length === 0 && <span className="text-muted-foreground">—</span>}
            </div>
          ) },
          { key: "loc", header: "Local", render: (p: any) => <span className="text-xs">{p.city}/{p.uf}</span> },
          { key: "date", header: "Cadastro", render: (p: any) => {
            const days = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000);
            return <div className="text-xs"><p>{formatDateBR(p.created_at)}</p><p className="text-muted-foreground">há {days}d</p></div>;
          } },
          { key: "act", header: "", render: (p: any) => tab === "PENDING_VALIDATION" ? (
            <div className="flex gap-2 justify-end">
              <button onClick={() => setApprovingId(p.id)} className="px-3 py-1.5 rounded-md bg-success text-success-foreground text-xs font-semibold">Aprovar</button>
              <button onClick={() => { setRejectingId(p.id); setRejectReason(""); }} className="px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-xs font-semibold">Recusar</button>
            </div>
          ) : tab === "REJECTED" ? (
            <span className="text-xs text-muted-foreground italic max-w-xs block truncate">{p.validation_notes}</span>
          ) : (
            <span className="text-xs text-muted-foreground">{formatDateBR(p.validated_at)}</span>
          ) },
        ]}
      />

      <ConfirmModal
        open={!!approvingId} onClose={() => setApprovingId(null)}
        title="Aprovar motorista" description="O motorista poderá enviar propostas e realizar viagens."
        confirmLabel="Aprovar"
        onConfirm={async () => { await approve({ data: { id: approvingId! } }); toast.success("Motorista aprovado"); refresh(); }}
      />
      <ConfirmModal
        open={!!rejectingId} onClose={() => setRejectingId(null)}
        title="Recusar motorista" description="Informe o motivo. O motorista poderá corrigir e reenviar os documentos."
        confirmLabel="Recusar" tone="danger"
        onConfirm={async () => {
          if (rejectReason.trim().length < 3) { toast.error("Informe um motivo válido"); throw new Error("motivo curto"); }
          await reject({ data: { id: rejectingId!, reason: rejectReason.trim() } });
          toast.success("Cadastro recusado"); refresh();
        }}
      >
        <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Motivo da recusa" rows={4}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
      </ConfirmModal>
    </div>
  );
}
