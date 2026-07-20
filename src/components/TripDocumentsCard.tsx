import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTripDocuments } from "@/lib/documents.functions";
import { formatDateTimeBR } from "@/lib/format";
import { Copy, Check, FileText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Doc = {
  id: string;
  doc_type: "CTE" | "MDFE" | "CIOT" | "AVERBACAO";
  doc_number: string | null;
  access_key: string | null;
  status: "PENDING" | "ISSUED" | "CANCELLED";
  issued_at: string | null;
  payload: Record<string, any>;
  provider: string;
  event_type: "ISSUED" | "COMPLEMENTAR" | "DELIVERED" | "CLOSED" | "CANCELLED" | null;
  parent_doc_id: string | null;
};

const LABEL: Record<Doc["doc_type"], string> = {
  CTE: "CT-e — Conhecimento de Transporte",
  MDFE: "MDF-e — Manifesto de Documentos",
  CIOT: "CIOT — Operação de Transporte",
  AVERBACAO: "Averbação de Seguro",
};

function StatusPill({ s }: { s: Doc["status"] }) {
  const cfg: Record<Doc["status"], { label: string; cls: string }> = {
    ISSUED: { label: "Emitido", cls: "bg-success/10 text-success border-success/30" },
    PENDING: { label: "Pendente", cls: "bg-warning/10 text-warning border-warning/30" },
    CANCELLED: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border" },
  };
  const c = cfg[s];
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${c.cls}`}>{c.label}</span>;
}

function DocRow({ d }: { d: Doc }) {
  const [copied, setCopied] = useState(false);
  const key = d.access_key ?? d.doc_number ?? "";
  async function copy() {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      toast.success("Copiado");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }
  const encerrado = d.doc_type === "MDFE" && (d.payload as any)?.encerrado === true;
  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm font-semibold">{LABEL[d.doc_type]}</p>
            <StatusPill s={d.status} />
            {encerrado && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-accent/40 bg-accent/10 text-accent font-semibold">Encerrado</span>
            )}
          </div>
          {d.doc_number && (
            <p className="mt-1 text-xs text-muted-foreground">
              Nº <span className="font-mono text-foreground">{d.doc_number}</span>
            </p>
          )}
          {d.access_key && (
            <p className="mt-1 text-xs text-muted-foreground break-all">
              Chave: <span className="font-mono text-foreground">{d.access_key}</span>
            </p>
          )}
          {d.issued_at && (
            <p className="mt-1 text-[11px] text-muted-foreground">Emitido em {formatDateTimeBR(d.issued_at)}</p>
          )}
        </div>
        {key && (
          <button
            onClick={copy}
            className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
            title="Copiar"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "Copiado" : "Copiar"}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function TripDocumentsCard({
  jobId,
  actions,
}: {
  jobId: string;
  actions?: React.ReactNode;
}) {
  const list = useServerFn(listTripDocuments);
  const q = useQuery({
    queryKey: ["trip-documents", jobId],
    queryFn: () => list({ data: { job_id: jobId } }),
  });
  const docs = (q.data ?? []) as Doc[];

  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Documentos da viagem</p>
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Emitido via parceiro fiscal
          </p>
        </div>
        {actions}
      </div>
      <div className="mt-3 space-y-2">
        {q.isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
        {!q.isLoading && docs.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Documentos serão emitidos após a confirmação do pagamento.
          </p>
        )}
        {docs.map((d) => (
          <DocRow key={d.id} d={d} />
        ))}
      </div>
    </div>
  );
}
