import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyInvoices } from "@/lib/finance.functions";
import { AppHeader } from "@/components/AppHeader";
import { ContractorNav } from "@/components/RoleNav";
import { formatBRL, formatDateBR } from "@/lib/format";
import { FileText, TrendingUp } from "lucide-react";
import { useRequireAuth } from "@/hooks/use-require-auth";

export const Route = createFileRoute("/embarcador/faturas")({
  head: () => ({ meta: [{ title: "Minhas faturas — Freela Fretes" }] }),
  component: MinhasFaturas,
});

function MinhasFaturas() {
  useRequireAuth("contractor");
  const fn = useServerFn(listMyInvoices);
  const q = useQuery({ queryKey: ["my-invoices"], queryFn: () => fn() });
  const list = (q.data ?? []) as any[];
  const totalIcms = list.reduce((a, i) => a + (i.icms_cents ?? 0), 0);

  return (
    <div className="pb-24">
      <AppHeader title="Minhas faturas" />
      <div className="px-4 pt-4 space-y-3">
        <div className="rounded-2xl border border-success/40 bg-success/10 p-4">
          <div className="flex items-center gap-2 text-success">
            <TrendingUp className="h-4 w-4" />
            <p className="text-sm font-semibold">Crédito de ICMS para sua empresa</p>
          </div>
          <p className="mt-1 text-2xl font-black text-success">{formatBRL(totalIcms)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Soma do ICMS destacado nos CT-e emitidos pela Freela Fretes Transportes. Este valor é
            crédito recuperável na apuração fiscal da sua empresa.
          </p>
        </div>

        {q.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!q.isLoading && list.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="mt-2 text-sm font-semibold">Você ainda não tem faturas</p>
            <p className="text-xs text-muted-foreground">Suas faturas aparecerão aqui após a conclusão das viagens.</p>
          </div>
        )}

        {list.map((inv) => {
          const f = inv.jobs?.freights;
          return (
            <Link
              key={inv.id}
              to="/embarcador/fatura/$id"
              params={{ id: inv.id }}
              className="block rounded-2xl bg-card border border-border p-4 shadow-card hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Fatura de {formatDateBR(inv.issued_at)}</p>
                  <p className="mt-0.5 text-sm font-semibold truncate">{f?.title ?? "Viagem"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {f?.origin_city}/{f?.origin_uf} → {f?.destination_city}/{f?.destination_uf}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-black">{formatBRL(inv.amount_cents)}</p>
                  <p className="text-[11px] text-success font-semibold">
                    ICMS {formatBRL(inv.icms_cents)}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <ContractorNav />
    </div>
  );
}
