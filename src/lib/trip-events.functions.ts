import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const eventTypes = [
  "ARRIVED_PICKUP",
  "LOADING_FINISHED",
  "TRIP_STARTED",
  "REST_STARTED",
  "REST_ENDED",
  "ARRIVED_DESTINATION",
  "UNLOADING_STARTED",
  "UNLOADING_FINISHED",
  "INCIDENT_REPORTED",
] as const;

const incidentKinds = ["ACCIDENT", "THEFT", "BREAKDOWN", "DAMAGE"] as const;

const recordInput = z.object({
  job_id: z.string().uuid(),
  type: z.enum(eventTypes),
  notes: z.string().max(2000).optional().nullable(),
  incident_kind: z.enum(incidentKinds).optional().nullable(),
});

export const recordTripEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => recordInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: job } = await context.supabase
      .from("jobs")
      .select("id,provider_id,contractor_id,status,disputed")
      .eq("id", data.job_id)
      .maybeSingle();
    if (!job) throw new Error("Viagem não encontrada");
    const { data: prov } = await context.supabase
      .from("providers")
      .select("id,full_name")
      .eq("id", job.provider_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!prov) throw new Error("Somente o motorista da viagem pode registrar eventos");

    if (data.type === "INCIDENT_REPORTED" && !data.incident_kind) {
      throw new Error("Informe o tipo da ocorrência");
    }

    const { error } = await context.supabase.from("trip_events").insert({
      job_id: data.job_id,
      type: data.type,
      notes: data.notes ?? null,
      incident_kind: data.type === "INCIDENT_REPORTED" ? data.incident_kind ?? null : null,
      created_by: context.userId,
    });
    if (error) throw error;

    if (data.type === "INCIDENT_REPORTED") {
      await context.supabase
        .from("jobs")
        .update({ disputed: true, dispute_notes: `[${data.incident_kind}] ${data.notes ?? ""}`.slice(0, 2000) })
        .eq("id", job.id);

      const { data: contractor } = await context.supabase
        .from("contractors")
        .select("user_id")
        .eq("id", job.contractor_id)
        .maybeSingle();
      const { notify } = await import("./notify.server");
      await notify(
        contractor?.user_id,
        "⚠ Ocorrência informada",
        `${prov.full_name} reportou uma ocorrência (${data.incident_kind}). O pagamento ficou retido até análise.`,
        `/embarcador/viagem/${job.id}`,
      );
    }
    return { ok: true };
  });
