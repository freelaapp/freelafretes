import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { withdrawCandidacy } from "@/lib/api.functions";
import { useAuth } from "@/hooks/use-auth";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AppHeader } from "@/components/AppHeader";
import { ProviderNav } from "@/components/RoleNav";
import { Badge, ButtonOutline } from "@/components/ui-kit";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/motorista/propostas")({
  head: () => ({ meta: [{ title: "Minhas Propostas — Freela Fretes" }] }),
  component: MyProposals,
});

function MyProposals() {
  useRequireAuth("provider");
  const auth = useAuth();
  const qc = useQueryClient();
  const withdraw = useServerFn(withdrawCandidacy);

  const { data: candidacies = [] } = useQuery({
    enabled: !!auth.user,
    queryKey: ["my-candidacies", auth.user?.id],
    queryFn: async () => {
      const { data: p } = await supabase.from("providers").select("id").eq("user_id", auth.user!.id).maybeSingle();
      if (!p) return [];
      const { data } = await supabase.from("candidacies")
        .select("*, freights(title,origin_city,origin_uf,destination_city,destination_uf,base_amount_in_cents)")
        .eq("provider_id", p.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function onWithdraw(id: string) {
    if (!confirm("Retirar essa proposta?")) return;
    try { await withdraw({ data: { candidacy_id: id } }); toast.success("Proposta retirada"); qc.invalidateQueries(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div className="pb-24">
      <AppHeader title="Minhas propostas" />
      <div className="px-4 pt-4 space-y-3">
        {candidacies.length === 0 && <p className="text-sm text-muted-foreground text-center py-12">Nenhuma proposta ainda.</p>}
        {candidacies.map((c) => {
          const f = c.freights as { title: string; origin_city: string; origin_uf: string; destination_city: string; destination_uf: string; base_amount_in_cents: number };
          const value = c.proposed_amount_in_cents ?? f.base_amount_in_cents;
          return (
            <div key={c.id} className="rounded-2xl bg-card border border-border p-4 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <Link to="/motorista/frete/$id" params={{ id: c.freight_id }} className="font-semibold text-sm truncate flex-1">{f.title}</Link>
                {statusBadge(c.status)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{f.origin_city}/{f.origin_uf} → {f.destination_city}/{f.destination_uf}</p>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-primary font-bold">{formatBRL(value)}</span>
                {c.proposed_amount_in_cents != null && <span className="text-[11px] text-muted-foreground">Contraproposta</span>}
              </div>
              {c.status === "PENDING" && (
                <div className="mt-3"><ButtonOutline onClick={() => onWithdraw(c.id)}>Retirar proposta</ButtonOutline></div>
              )}
            </div>
          );
        })}
      </div>
      <ProviderNav />
    </div>
  );
}

function statusBadge(s: string) {
  const m: Record<string, [string, "warning" | "success" | "danger" | "muted"]> = {
    PENDING: ["Aguardando resposta", "warning"],
    ACCEPTED: ["Aceita 🎉", "success"],
    REJECTED: ["Recusada", "danger"],
    WITHDRAWN: ["Retirada", "muted"],
    CANCELLED_BY_CONTRACTOR: ["Cancelada pela empresa", "muted"],
  };
  const [l, t] = m[s] ?? [s, "muted"];
  return <Badge tone={t}>{l}</Badge>;
}
