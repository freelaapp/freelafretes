import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AppHeader } from "@/components/AppHeader";
import { ContractorNav } from "@/components/RoleNav";
import { Badge } from "@/components/ui-kit";
import { formatBRL, formatDateBR } from "@/lib/format";
import { MapPin, PlusCircle } from "lucide-react";

export const Route = createFileRoute("/embarcador/fretes")({
  head: () => ({ meta: [{ title: "Meus Fretes — Freela Fretes" }] }),
  component: MyFreights,
});

function MyFreights() {
  const auth = useRequireAuth("contractor");
  const { data: freights = [] } = useQuery({
    enabled: !!auth.user,
    queryKey: ["my-freights", auth.user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("contractors").select("id").eq("user_id", auth.user!.id).maybeSingle();
      if (!data) return [];
      const { data: fr } = await supabase.from("freights").select("*").eq("contractor_id", data.id).order("created_at", { ascending: false });
      const ids = (fr ?? []).map((f) => f.id);
      let counts: Record<string, number> = {};
      if (ids.length) {
        const { data: cs } = await supabase.from("candidacies").select("freight_id").in("freight_id", ids).eq("status", "PENDING");
        counts = (cs ?? []).reduce<Record<string, number>>((acc, c) => { acc[c.freight_id] = (acc[c.freight_id] ?? 0) + 1; return acc; }, {});
      }
      return (fr ?? []).map((f) => ({ ...f, pending_count: counts[f.id] ?? 0 }));
    },
  });

  return (
    <div className="pb-24">
      <AppHeader title="Meus Fretes" subtitle="A Freela Fretes transporta para você" right={
        <Link to="/embarcador/publicar" className="inline-flex items-center gap-1 rounded-full bg-accent text-accent-foreground px-3 py-1.5 text-xs font-semibold">
          <PlusCircle className="h-4 w-4" /> Publicar
        </Link>
      } />
      <div className="px-4 pt-4 space-y-3">
        {freights.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">Você ainda não publicou fretes.</p>
            <Link to="/embarcador/publicar" className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">
              <PlusCircle className="h-4 w-4" /> Publicar frete
            </Link>
          </div>
        )}
        {freights.map((f) => (
          <Link key={f.id} to="/embarcador/frete/$id" params={{ id: f.id }} className="block rounded-2xl bg-card border border-border p-4 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-sm truncate flex-1">{f.title}</p>
              {statusBadge(f.status)}
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {f.origin_city}/{f.origin_uf} → {f.destination_city}/{f.destination_uf}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-bold text-primary">{formatBRL(f.base_amount_in_cents)}</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Coleta: {formatDateBR(f.pickup_at)}</span>
                {f.pending_count > 0 && <Badge tone="accent">{f.pending_count} proposta{f.pending_count > 1 ? "s" : ""}</Badge>}
              </div>
            </div>
          </Link>
        ))}
      </div>
      <ContractorNav />
    </div>
  );
}

function statusBadge(s: string) {
  if (s === "OPEN") return <Badge tone="primary">Aberto</Badge>;
  if (s === "CLOSED") return <Badge tone="success">Motorista contratado</Badge>;
  return <Badge tone="muted">Cancelado</Badge>;
}
