import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFeedbacksAdmin, hideFeedback, unhideFeedback } from "@/lib/admin.functions";
import { PageHeader, DataTable, StatusBadge, Pagination, ConfirmModal } from "@/components/admin/ui";
import { formatDateBR } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/feedbacks")({
  head: () => ({ meta: [{ title: "Avaliações — Admin" }, { name: "robots", content: "noindex" }] }),
  component: FeedbacksAdmin,
});

function FeedbacksAdmin() {
  const [rating, setRating] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [hidden, setHidden] = useState<"all"|"visible"|"hidden">("all");
  const [page, setPage] = useState(1);
  const list = useServerFn(listFeedbacksAdmin);
  const hide = useServerFn(hideFeedback);
  const unhide = useServerFn(unhideFeedback);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["feedbacks-admin", rating, role, hidden, page], queryFn: () => list({ data: { rating: rating ? Number(rating) as any : undefined, role: (role || undefined) as any, hidden, page } }) });

  const [hideId, setHideId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-5">
      <PageHeader title="Avaliações" subtitle="Todas as avaliações trocadas entre partes" />
      <div className="flex flex-wrap gap-2">
        <select value={rating} onChange={(e) => { setRating(e.target.value); setPage(1); }} className="rounded-md border border-border px-3 py-2 text-sm bg-card">
          <option value="">Toda nota</option>{[1,2,3,4,5].map((n) => <option key={n} value={n}>{n} ★</option>)}
        </select>
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="rounded-md border border-border px-3 py-2 text-sm bg-card">
          <option value="">Todos autores</option>
          <option value="PROVIDER">Motorista</option>
          <option value="CONTRACTOR">Empresa</option>
        </select>
        <select value={hidden} onChange={(e) => { setHidden(e.target.value as any); setPage(1); }} className="rounded-md border border-border px-3 py-2 text-sm bg-card">
          <option value="all">Todas</option><option value="visible">Visíveis</option><option value="hidden">Ocultas</option>
        </select>
      </div>

      <DataTable
        rows={q.data?.rows ?? []}
        empty="Nenhuma avaliação."
        columns={[
          { key: "d", header: "Data", render: (f: any) => <span className="text-xs">{formatDateBR(f.created_at)}</span> },
          { key: "a", header: "Autor", render: (f: any) => <StatusBadge tone="info">{f.role === "PROVIDER" ? "Motorista" : "Empresa"}</StatusBadge> },
          { key: "r", header: "Nota", render: (f: any) => (
            <div className="flex items-center gap-1">
              <span className="font-bold">{f.rating}★</span>
              {f.rating <= 2 && <StatusBadge tone="danger">Atenção</StatusBadge>}
            </div>
          ) },
          { key: "c", header: "Comentário", render: (f: any) => <span className="text-xs max-w-md block">{f.comment ?? "—"}</span> },
          { key: "h", header: "", render: (f: any) => f.hidden ? (
            <button onClick={async () => { await unhide({ data: { id: f.id } }); toast.success("Reexibida"); qc.invalidateQueries({ queryKey: ["feedbacks-admin"] }); }} className="px-2 py-1 rounded bg-muted text-xs">Reexibir</button>
          ) : (
            <button onClick={() => { setHideId(f.id); setReason(""); }} className="px-2 py-1 rounded bg-destructive/20 text-destructive text-xs font-semibold">Ocultar</button>
          ) },
        ]}
      />
      <Pagination page={page} total={q.data?.total ?? 0} onChange={setPage} />

      <ConfirmModal open={!!hideId} onClose={() => setHideId(null)}
        title="Ocultar avaliação" description="Some do app público, permanece no banco." tone="danger" confirmLabel="Ocultar"
        onConfirm={async () => {
          if (reason.trim().length < 3) { toast.error("Motivo obrigatório"); throw new Error("motivo"); }
          await hide({ data: { id: hideId!, reason: reason.trim() } });
          toast.success("Avaliação ocultada");
          qc.invalidateQueries({ queryKey: ["feedbacks-admin"] });
        }}>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (ex.: linguagem ofensiva)" rows={3} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
      </ConfirmModal>
    </div>
  );
}
