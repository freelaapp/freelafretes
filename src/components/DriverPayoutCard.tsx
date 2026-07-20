import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDriverPayout } from "@/lib/finance.functions";
import { formatBRL } from "@/lib/format";
import { Info, Wallet, ShieldCheck } from "lucide-react";
import { useState } from "react";

export function DriverPayoutCard({ jobId }: { jobId: string }) {
  const fn = useServerFn(getDriverPayout);
  const q = useQuery({ queryKey: ["driver-payout", jobId], queryFn: () => fn({ data: { job_id: jobId } }) });
  const p = q.data as any;
  const [tip, setTip] = useState(false);

  if (q.isLoading) return null;
  if (!p) return null;

  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Extrato deste frete</p>
        {p.status === "PAID" && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-success/40 bg-success/10 text-success font-semibold inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Pago via PIX
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1.5 text-sm">
        <Row label="Valor bruto do frete" value={formatBRL(p.gross_cents)} />
        <div className="flex items-start justify-between text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            (–) INSS (2,2%)
            <button
              type="button"
              onMouseEnter={() => setTip(true)}
              onMouseLeave={() => setTip(false)}
              onClick={() => setTip((v) => !v)}
              className="inline-flex"
              aria-label="Explicação das retenções"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </span>
          <span className="text-foreground">− {formatBRL(p.inss_cents)}</span>
        </div>
        <Row label="(–) SEST/SENAT (0,5%)" value={`− ${formatBRL(p.sest_senat_cents)}`} muted />
        {tip && (
          <div className="mt-1 rounded-lg border border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
            Recolhimentos legais do TAC (Lei 8.212/91). A Freela Fretes recolhe automaticamente
            INSS (2,2%) e SEST/SENAT (0,5%) sobre o valor bruto do seu frete e repassa aos órgãos
            competentes. Você recebe o valor líquido no seu PIX.
          </div>
        )}
        <div className="border-t border-border pt-2 mt-2 flex items-center justify-between">
          <span className="font-semibold">Líquido recebido</span>
          <span className="text-lg font-black text-success">{formatBRL(p.net_cents)}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className={muted ? "text-foreground" : "font-semibold"}>{value}</span>
    </div>
  );
}
