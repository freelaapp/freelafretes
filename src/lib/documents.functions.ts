import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Lista documentos da viagem. RLS já restringe a leitura ao embarcador, motorista e admin.
export const listTripDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ job_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("freight_documents")
      .select("*")
      .eq("job_id", data.job_id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

// Reemissão pelo admin: cancela documentos anteriores e reemite. Grava audit log.
export const adminReissueTripDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ job_id: z.string().uuid(), reason: z.string().min(3).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: admin, error: aErr } = await context.supabase
      .from("admins")
      .select("id,is_active")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (aErr || !admin || !admin.is_active) throw new Error("Acesso negado");

    const { documentProvider } = await import("./document-emission.server");
    const { data: job } = await context.supabase
      .from("jobs")
      .select(
        "id,freight_mode,agreed_amount_in_cents,freights(title,origin_city,origin_uf,destination_city,destination_uf,weight_kg,cargo_type,freight_mode)",
      )
      .eq("id", data.job_id)
      .maybeSingle();
    if (!job) throw new Error("Viagem não encontrada");

    await documentProvider.cancelDocuments(data.job_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("freight_documents").delete().eq("job_id", data.job_id).eq("status", "CANCELLED");
    const rows = await documentProvider.emitTripDocuments(job as any);

    await context.supabase.from("admin_audit_logs").insert({
      admin_id: admin.id,
      action: "REISSUE_TRIP_DOCUMENTS",
      entity_type: "job",
      entity_id: data.job_id,
      details: { reason: data.reason, count: rows.length },
    });

    return { ok: true, count: rows.length };
  });

// Emite CT-e complementar (admin) — usado quando um incidente com custo extra é aprovado.
export const adminEmitComplementarCte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      job_id: z.string().uuid(),
      valor_reais: z.number().positive(),
      motivo: z.string().min(3).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: admin, error: aErr } = await context.supabase
      .from("admins").select("id,is_active").eq("user_id", context.userId).maybeSingle();
    if (aErr || !admin || !admin.is_active) throw new Error("Acesso negado");

    const { data: job } = await context.supabase
      .from("jobs")
      .select("id,agreed_amount_in_cents,freights(title,origin_city,origin_uf,destination_city,destination_uf,weight_kg,cargo_type,freight_mode,driver_payout_cents)")
      .eq("id", data.job_id)
      .maybeSingle();
    if (!job) throw new Error("Viagem não encontrada");

    const { documentProvider } = await import("./document-emission.server");
    const valorCentavos = Math.round(data.valor_reais * 100);
    const doc = await documentProvider.emitCTeComplementar(job as any, valorCentavos, data.motivo);

    await context.supabase.from("admin_audit_logs").insert({
      admin_id: admin.id,
      action: "EMIT_COMPLEMENTAR_CTE",
      entity_type: "job",
      entity_id: data.job_id,
      details: { motivo: data.motivo, valor_centavos: valorCentavos, doc_id: doc.id },
    });

    return { ok: true, doc_id: doc.id };
  });
