import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AppHeader } from "@/components/AppHeader";
import { ProviderNav } from "@/components/RoleNav";
import { Badge } from "@/components/ui-kit";
import { formatBRL, formatDateBR } from "@/lib/format";

export const Route = createFileRoute("/motorista/viagens")({
  head: () => ({ meta: [{ title: "Minhas Viagens — Freela Fretes" }] }),
  component: DriverTrips,
});

function DriverTrips() {
  useRequireAuth("provider");
  const auth = useAuth();
  const { data: jobs = [] } = useQuery({
    enabled: !!auth.user,
    queryKey: ["driver-jobs", auth.user?.id],
    queryFn: async () => {
      const { data: p } = await supabase.from("providers").select("id").eq("user_id", auth.user!.id).maybeSingle();
      if (!p) return [];
      const { data } = await supabase.from("jobs")
        .select("*, freights(title,origin_city,origin_uf,destination_city,destination_uf,pickup_at)")
        .eq("provider_id", p.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="pb-24">
      <AppHeader title="Minhas viagens" />
      <div className="px-4 pt-4 space-y-3">
        {jobs.length === 0 && <p className="text-sm text-muted-foreground text-center py-12">Nenhuma viagem.</p>}
        {jobs.map((j) => {
          const f = j.freights as { title: string; origin_city: string; origin_uf: string; destination_city: string; destination_uf: string; pickup_at: string };
          return (
            <Link key={j.id} to="/motorista/viagem/$id" params={{ id: j.id }} className="block rounded-2xl bg-card border border-border p-4 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm truncate flex-1">{f.title}</p>
                {statusBadge(j.status)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{f.origin_city}/{f.origin_uf} → {f.destination_city}/{f.destination_uf}</p>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span>Coleta: {formatDateBR(f.pickup_at)}</span>
                <span className="font-bold text-primary">{formatBRL(j.agreed_amount_in_cents)}</span>
              </div>
            </Link>
          );
        })}
      </div>
      <ProviderNav />
    </div>
  );
}

function statusBadge(s: string) {
  const m: Record<string, [string, "warning" | "accent" | "success" | "muted"]> = {
    SCHEDULED: ["Agendada", "warning"],
    IN_PROGRESS: ["Em andamento", "accent"],
    COMPLETED: ["Concluída", "success"],
    CANCELLED: ["Cancelada", "muted"],
  };
  const [l, t] = m[s] ?? [s, "muted"];
  return <Badge tone={t}>{l}</Badge>;
}
