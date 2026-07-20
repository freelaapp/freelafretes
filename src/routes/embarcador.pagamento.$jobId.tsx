import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { simulatePaymentPaid } from "@/lib/api.functions";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AppHeader } from "@/components/AppHeader";
import { ButtonPrimary } from "@/components/ui-kit";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import { QrCode, Copy, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/embarcador/pagamento/$jobId")({
  head: () => ({ meta: [{ title: "Pagamento — Freela Fretes" }] }),
  component: Payment,
});

function Payment() {
  const { jobId } = Route.useParams();
  useRequireAuth("contractor");
  const nav = useNavigate();
  const qc = useQueryClient();
  const simulate = useServerFn(simulatePaymentPaid);

  const { data: job } = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*, freights(*), providers(full_name)").eq("id", jobId).maybeSingle();
      return data;
    },
  });
  const { data: payment } = useQuery({
    queryKey: ["payment", jobId],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*").eq("job_id", jobId).maybeSingle();
      return data;
    },
  });

  const total = payment?.amount_in_cents ?? 0;
  const pixCode = `00020126...FREELAFRETES.${jobId.slice(0,8).toUpperCase()}...5204000053039865802BR6009SAO PAULO62070503***6304ABCD`;

  async function pay() {
    try {
      await simulate({ data: { job_id: jobId } });
      toast.success("Pagamento confirmado!");
      qc.invalidateQueries();
      nav({ to: "/embarcador/viagem/$id", params: { id: jobId } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  if (!job || !payment) return <div className="p-6 text-sm">Carregando...</div>;
  const freight = job.freights as { title: string; origin_city: string; origin_uf: string; destination_city: string; destination_uf: string };
  const provider = job.providers as { full_name: string };

  return (
    <div className="pb-10">
      <AppHeader title="Pagamento via PIX" subtitle="Valor fica em custódia até a entrega" />
      <div className="px-4 pt-4 space-y-3">
        <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Rota</p>
          <p className="font-semibold text-sm">{freight.origin_city}/{freight.origin_uf} → {freight.destination_city}/{freight.destination_uf}</p>
          <p className="text-xs text-muted-foreground mt-1">{freight.title}</p>
          <div className="border-t border-border mt-3 pt-3 text-sm">
            <p className="text-xs text-muted-foreground">Motorista</p>
            <p className="font-semibold">{provider.full_name}</p>
          </div>
          <div className="border-t border-border mt-3 pt-3 space-y-1 text-sm">
            <div className="flex justify-between font-bold text-primary"><span>Total do frete</span><span>{formatBRL(total)}</span></div>
            <p className="text-[11px] text-muted-foreground pt-1">Inclui transporte, documentação fiscal (CT-e, MDF-e, CIOT), seguro RCTR-C e repasse ao motorista. Sem taxas adicionais.</p>
          </div>
        </div>

        {payment.status === "PENDING" ? (
          <>
            <div className="rounded-2xl bg-card border border-border p-6 shadow-card text-center">
              <div className="mx-auto h-40 w-40 rounded-2xl bg-secondary grid place-items-center">
                <QrCode className="h-20 w-20 text-primary" />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Escaneie o QR Code no app do seu banco</p>
              <div className="mt-3 rounded-xl bg-muted px-3 py-2 text-[10px] break-all text-left flex items-start gap-2">
                <code className="flex-1">{pixCode}</code>
                <button onClick={() => { navigator.clipboard.writeText(pixCode); toast.success("Copiado"); }} className="text-primary shrink-0">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">O valor fica em custódia e é liberado ao motorista após a entrega confirmada.</p>
            </div>
            {/* TODO: substituir por webhook do provedor real */}
            <ButtonPrimary onClick={pay}>✓ Já paguei (simulação)</ButtonPrimary>
          </>
        ) : (
          <div className="rounded-2xl bg-success/10 border border-success p-4 flex items-start gap-3">
            <ShieldCheck className="h-6 w-6 text-success shrink-0" />
            <div>
              <p className="font-semibold text-sm">Pagamento em custódia</p>
              <p className="text-xs text-muted-foreground">Será liberado ao motorista após a entrega.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
