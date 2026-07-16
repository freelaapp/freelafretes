import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTimeBR } from "@/lib/format";
import { Check, Circle, Truck } from "lucide-react";

const LABELS: Record<string, string> = {
  ARRIVED_PICKUP: "Chegou para carregar",
  LOADING_FINISHED: "Carregamento concluído",
  TRIP_STARTED: "Viagem iniciada",
  REST_STARTED: "Pausa iniciada",
  REST_ENDED: "Viagem retomada",
  ARRIVED_DESTINATION: "Chegou ao destino",
  UNLOADING_STARTED: "Descarregamento iniciado",
  UNLOADING_FINISHED: "Descarregamento concluído",
  INCIDENT_REPORTED: "⚠ Ocorrência reportada",
};

export type TripEvent = { id: string; type: string; notes: string | null; incident_kind: string | null; created_at: string };

export function useTripEvents(jobId: string) {
  return useQuery({
    queryKey: ["trip-events", jobId],
    queryFn: async () => {
      const { data } = await supabase
        .from("trip_events")
        .select("id,type,notes,incident_kind,created_at")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });
      return (data ?? []) as TripEvent[];
    },
  });
}

export function TripChecklist({ events, jobStatus }: { events: TripEvent[]; jobStatus: string }) {
  const has = (t: string) => events.some((e) => e.type === t);
  const loading = has("LOADING_FINISHED") || jobStatus === "IN_PROGRESS" || jobStatus === "COMPLETED";
  const inTransit = jobStatus === "IN_PROGRESS" || jobStatus === "COMPLETED";
  const delivered = has("UNLOADING_FINISHED") || jobStatus === "COMPLETED";
  const step = (done: boolean, active: boolean, label: string) => (
    <div className="flex-1 flex flex-col items-center gap-1">
      <div className={`h-8 w-8 rounded-full grid place-items-center ${done ? "bg-success text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
        {done ? <Check className="h-4 w-4" /> : active ? <Truck className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
      </div>
      <p className={`text-[11px] font-semibold text-center ${done ? "text-success" : active ? "text-primary" : "text-muted-foreground"}`}>{label}</p>
    </div>
  );
  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <p className="text-sm font-semibold mb-3">Progresso da viagem</p>
      <div className="flex items-start gap-2">
        {step(loading, !loading && jobStatus !== "SCHEDULED", "Carregamento")}
        {step(delivered, inTransit && !delivered, "Em Trânsito")}
        {step(delivered, false, "Entrega")}
      </div>
    </div>
  );
}

export function TripEventLog({ events }: { events: TripEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <p className="text-sm font-semibold mb-3">Linha do tempo</p>
      <ol className="space-y-2">
        {events.map((e) => (
          <li key={e.id} className="flex items-start gap-3 text-sm">
            <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${e.type === "INCIDENT_REPORTED" ? "bg-destructive" : "bg-primary"}`} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {LABELS[e.type] ?? e.type}
                {e.incident_kind ? <span className="ml-1 text-destructive">({e.incident_kind})</span> : null}
              </p>
              {e.notes && <p className="text-xs text-muted-foreground">{e.notes}</p>}
              <p className="text-[11px] text-muted-foreground">{formatDateTimeBR(e.created_at)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
