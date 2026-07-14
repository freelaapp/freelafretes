import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProviderAdmin, setProviderActive, banProvider } from "@/lib/admin.functions";
import { PageHeader, StatusBadge, ConfirmModal, DataTable } from "@/components/admin/ui";
import { formatDateBR } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin/providers/$id")({
  head: () => ({ meta: [{ title: "Motorista — Admin" }, { name: "robots", content: "noindex" }] }),
  component: ProviderDetail,
});

function ProviderDetail() {
  const { id } = Route.useParams();
  const get = useServerFn(getProviderAdmin);
  const setActive = useServerFn(setProviderActive);
  const ban = useServerFn(banProvider);
  const q = useQuery({ queryKey: ["provider-admin", id], queryFn: () => get({ data: { id } }) });
  const qc = useQueryClient();
  const [toggleOpen, setToggleOpen] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [banReason, setBanReason] = useState("");
  const p = q.data?.provider;

  if (!p) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  const avgRating = (() => {
    const arr = (q.data?.feedbacks ?? []).filter((f: any) => !f.hidden);
    if (!arr.length) return null;
    return (arr.reduce((a: number, f: any) => a + f.rating, 0) / arr.length).toFixed(1);
  })();

  return (
    <div className="space-y-6">
      <Link to="/admin/providers" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
      <PageHeader
        title={p.full_name}
        subtitle={`${p.email} · ${p.phone}`}
        right={
          <div className="flex items-center gap-2">
            {p.is_banned && <StatusBadge tone="danger">Banido</StatusBadge>}
            {avgRating && <StatusBadge tone="primary">★ {avgRating}</StatusBadge>}
            <button onClick={() => setToggleOpen(true)} className="px-3 py-1.5 rounded-md border border-border text-sm">
              {p.is_active ? "Desativar" : "Reativar"}
            </button>
            {!p.is_banned && <button onClick={() => setBanOpen(true)} className="px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-sm font-semibold">Banir</button>}
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">Dados</h3>
          <dl className="text-sm space-y-1.5">
            <Row k="CPF" v={p.cpf} />
            <Row k="Nascimento" v={formatDateBR(p.birthdate)} />
            <Row k="CNH" v={`${p.cnh_category} · ${p.cnh_number}`} />
            <Row k="CNH válida até" v={formatDateBR(p.cnh_expires_at)} />
            <Row k="Localização" v={`${p.city ?? "-"}/${p.uf ?? "-"}`} />
            <Row k="Cadastro" v={formatDateBR(p.created_at)} />
            {p.ban_reason && <Row k="Motivo banimento" v={p.ban_reason} />}
          </dl>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 lg:col-span-2">
          <h3 className="font-semibold text-sm mb-3">Veículos ({q.data?.vehicles.length ?? 0})</h3>
          <DataTable
            rows={q.data?.vehicles ?? []}
            empty="Nenhum veículo."
            columns={[
              { key: "t", header: "Tipo", render: (v: any) => <span className="text-sm">{v.vehicle_type}</span> },
              { key: "c", header: "Carroceria", render: (v: any) => <span className="text-sm">{v.body_type}</span> },
              { key: "p", header: "Placa", render: (v: any) => <span className="text-sm font-mono">{v.plate}</span> },
              { key: "k", header: "Cap. kg", render: (v: any) => <span className="text-sm">{v.capacity_kg}</span> },
              { key: "s", header: "Status", render: (v: any) => v.is_active ? <StatusBadge tone="success">Ativo</StatusBadge> : <StatusBadge tone="muted">Inativo</StatusBadge> },
            ]}
          />
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Viagens ({q.data?.jobs.length ?? 0})</h3>
        <DataTable
          rows={q.data?.jobs ?? []}
          empty="Nenhuma viagem."
          columns={[
            { key: "d", header: "Data", render: (j: any) => <span className="text-xs">{formatDateBR(j.created_at)}</span> },
            { key: "s", header: "Status", render: (j: any) => <StatusBadge tone={j.status === "COMPLETED" ? "success" : j.status === "CANCELLED" ? "danger" : "primary"}>{j.status}</StatusBadge> },
            { key: "l", header: "", render: (j: any) => <Link to="/admin/jobs/$id" params={{ id: j.id }} className="text-xs text-primary font-semibold">Ver →</Link> },
          ]}
        />
      </div>

      <ConfirmModal open={toggleOpen} onClose={() => setToggleOpen(false)}
        title={p.is_active ? "Desativar motorista" : "Reativar motorista"}
        confirmLabel={p.is_active ? "Desativar" : "Reativar"}
        tone={p.is_active ? "danger" : "primary"}
        onConfirm={async () => {
          await setActive({ data: { id: p.id, is_active: !p.is_active } });
          toast.success("Atualizado");
          qc.invalidateQueries({ queryKey: ["provider-admin", id] });
        }}
      />
      <ConfirmModal open={banOpen} onClose={() => setBanOpen(false)}
        title="Banir motorista" description="Ele perderá acesso, propostas pendentes serão retiradas."
        confirmLabel="Banir" tone="danger" requireText="BANIR"
        onConfirm={async () => {
          if (banReason.trim().length < 3) { toast.error("Motivo obrigatório"); throw new Error("motivo"); }
          await ban({ data: { id: p.id, reason: banReason.trim() } });
          toast.success("Motorista banido");
          qc.invalidateQueries({ queryKey: ["provider-admin", id] });
        }}>
        <textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Motivo do banimento" rows={3}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
      </ConfirmModal>
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right">{v}</dd></div>;
}
