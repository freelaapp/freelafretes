import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { SERVICE_FEE_BPS, makeCode } from "./server-helpers.server";
import { computeAnttFloor } from "./pricing.functions";


// ============================================================
// PUBLICAR FRETE
// ============================================================
const publishFreightInput = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional().nullable(),
  cargo_type: z.string().min(1),
  cargo_weight_kg: z.number().int().positive(),
  cargo_volume_m3: z.number().positive().optional().nullable(),
  freight_mode: z.enum(["LOTACAO", "FRACIONADO"]),
  mode_suggested: z.enum(["LOTACAO", "FRACIONADO"]).optional().nullable(),
  mode_override: z.boolean().default(false),
  vehicle_types: z.array(z.string()).default([]),
  body_types: z.array(z.string()).default([]),
  origin_city: z.string().min(1),
  origin_uf: z.string().length(2),
  origin_address: z.string().optional().nullable(),
  origin_cep: z.string().optional().nullable(),
  destination_city: z.string().min(1),
  destination_uf: z.string().length(2),
  destination_address: z.string().optional().nullable(),
  destination_cep: z.string().optional().nullable(),
  distance_km: z.number().int().positive(),
  pickup_at: z.string(),
  delivery_expected_at: z.string().optional().nullable(),
  toll_included: z.boolean().default(false),
  payment_reais: z.number().positive(),
  suggested_amount_in_cents: z.number().int().positive().optional().nullable(),
  pricing_breakdown: z.any().optional().nullable(),
  pricing_factors: z.any().optional().nullable(),
});

export const publishFreight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => publishFreightInput.parse(d))
  .handler(async ({ data, context }) => {
    const pickup = new Date(data.pickup_at);
    if (pickup.getTime() <= Date.now()) throw new Error("Data de coleta deve ser futura");
    if (data.delivery_expected_at) {
      const del = new Date(data.delivery_expected_at);
      if (del <= pickup) throw new Error("Previsão de entrega deve ser após a coleta");
    }
    const { data: contractor, error: cErr } = await context.supabase
      .from("contractors").select("id").eq("user_id", context.userId).maybeSingle();
    if (cErr || !contractor) throw new Error("Cadastro de empresa não encontrado");

    const base_amount_in_cents = Math.round(data.payment_reais * 100);
    const { data: freight, error } = await context.supabase.from("freights").insert({
      contractor_id: contractor.id,
      title: data.title,
      description: data.description ?? null,
      cargo_type: data.cargo_type,
      cargo_weight_kg: data.cargo_weight_kg,
      cargo_volume_m3: data.cargo_volume_m3 ?? null,
      freight_mode: data.freight_mode,
      mode_suggested: data.mode_suggested ?? null,
      mode_override: data.mode_override,
      vehicle_types: data.vehicle_types,
      body_types: data.body_types,
      origin_city: data.origin_city,
      origin_uf: data.origin_uf,
      origin_address: data.origin_address ?? null,
      origin_cep: data.origin_cep ?? null,
      destination_city: data.destination_city,
      destination_uf: data.destination_uf,
      destination_address: data.destination_address ?? null,
      destination_cep: data.destination_cep ?? null,
      distance_km: data.distance_km,
      pickup_at: data.pickup_at,
      delivery_expected_at: data.delivery_expected_at ?? null,
      toll_included: data.toll_included,
      // `payment` é sempre derivado de base_amount_in_cents (fonte única de verdade)
      payment: base_amount_in_cents / 100,
      base_amount_in_cents,
      suggested_amount_in_cents: data.suggested_amount_in_cents ?? null,
      pricing_breakdown: data.pricing_breakdown ?? null,
      pricing_factors: data.pricing_factors ?? null,
      status: "OPEN",
    }).select("id").single();
    if (error) throw error;
    return { id: freight.id };
  });

// ============================================================
// ENVIAR PROPOSTA
// ============================================================
const candidacyInput = z.object({
  freight_id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
  proposed_amount_reais: z.number().positive().nullable(),
  message: z.string().max(500).optional().nullable(),
});

export const submitCandidacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => candidacyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: provider } = await context.supabase
      .from("providers").select("id,validation_status").eq("user_id", context.userId).maybeSingle();
    if (!provider) throw new Error("Cadastro de motorista não encontrado");
    if (provider.validation_status !== "APPROVED") throw new Error("Sua conta ainda não foi aprovada. Você poderá enviar propostas após a aprovação.");


    const { data: freight } = await context.supabase.from("freights")
      .select("id,status,vehicle_types,body_types").eq("id", data.freight_id).maybeSingle();
    if (!freight || freight.status !== "OPEN") throw new Error("Frete indisponível");

    const { data: vehicle } = await context.supabase.from("vehicles")
      .select("id,provider_id,vehicle_type,body_type").eq("id", data.vehicle_id).maybeSingle();
    if (!vehicle || vehicle.provider_id !== provider.id) throw new Error("Veículo inválido");
    if (freight.vehicle_types?.length && !freight.vehicle_types.includes(vehicle.vehicle_type)) {
      throw new Error("Seu veículo não atende ao tipo exigido");
    }
    if (freight.body_types?.length && !freight.body_types.includes(vehicle.body_type)) {
      throw new Error("Sua carroceria não atende ao exigido");
    }

    const proposed = data.proposed_amount_reais != null ? Math.round(data.proposed_amount_reais * 100) : null;
    const { error } = await context.supabase.from("candidacies").insert({
      freight_id: data.freight_id,
      provider_id: provider.id,
      vehicle_id: data.vehicle_id,
      proposed_amount_in_cents: proposed,
      message: data.message ?? null,
      status: "PENDING",
    });
    if (error) {
      if (error.code === "23505") throw new Error("Você já enviou proposta para este frete");
      throw error;
    }
    // Notifica embarcador
    const { data: fr } = await context.supabase.from("freights").select("id,title,contractor_id").eq("id", data.freight_id).maybeSingle();
    if (fr) {
      const { data: c } = await context.supabase.from("contractors").select("user_id").eq("id", fr.contractor_id).maybeSingle();
      const { notify } = await import("./notify.server");
      await notify(c?.user_id, "Nova proposta recebida", `Um motorista enviou uma proposta para "${fr.title}".`, `/embarcador/frete/${fr.id}`);
    }
    return { ok: true };
  });

export const withdrawCandidacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ candidacy_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("candidacies")
      .update({ status: "WITHDRAWN" })
      .eq("id", data.candidacy_id)
      .eq("status", "PENDING");
    if (error) throw error;
    return { ok: true };
  });

export const rejectCandidacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ candidacy_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cand } = await context.supabase.from("candidacies")
      .select("id,freight_id,status").eq("id", data.candidacy_id).maybeSingle();
    if (!cand || cand.status !== "PENDING") throw new Error("Proposta indisponível");
    const { data: freight } = await context.supabase.from("freights")
      .select("id,contractor_id").eq("id", cand.freight_id).maybeSingle();
    if (!freight) throw new Error("Frete não encontrado");
    const { data: c } = await context.supabase.from("contractors")
      .select("id").eq("id", freight.contractor_id).eq("user_id", context.userId).maybeSingle();
    if (!c) throw new Error("Sem permissão");
    const { error } = await context.supabase.from("candidacies")
      .update({ status: "REJECTED" }).eq("id", cand.id).eq("status", "PENDING");
    if (error) throw error;
    const { data: prov } = await context.supabase.from("candidacies").select("provider_id,freight_id").eq("id", cand.id).maybeSingle();
    if (prov) {
      const { data: p } = await context.supabase.from("providers").select("user_id").eq("id", prov.provider_id).maybeSingle();
      const { notify } = await import("./notify.server");
      await notify(p?.user_id, "Proposta recusada", "Sua proposta foi recusada pelo embarcador.", `/motorista/frete/${prov.freight_id}`);
    }
    return { ok: true };
  });

// ============================================================
// ACEITAR PROPOSTA (fecha frete, cria job + payment)
// ============================================================
export const acceptCandidacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ candidacy_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cand } = await context.supabase.from("candidacies")
      .select("id,freight_id,provider_id,proposed_amount_in_cents,status")
      .eq("id", data.candidacy_id).maybeSingle();
    if (!cand || cand.status !== "PENDING") throw new Error("Proposta indisponível");

    const { data: freight } = await context.supabase.from("freights")
      .select("id,contractor_id,base_amount_in_cents,status").eq("id", cand.freight_id).maybeSingle();
    if (!freight || freight.status !== "OPEN") throw new Error("Frete não está aberto");

    // Verifica ownership
    const { data: contractor } = await context.supabase.from("contractors")
      .select("id").eq("id", freight.contractor_id).eq("user_id", context.userId).maybeSingle();
    if (!contractor) throw new Error("Sem permissão");

    const agreed = cand.proposed_amount_in_cents ?? freight.base_amount_in_cents;

    // Marca proposta aceita
    await context.supabase.from("candidacies").update({ status: "ACCEPTED" }).eq("id", cand.id);
    // Retira demais pendentes
    await context.supabase.from("candidacies").update({ status: "WITHDRAWN" })
      .eq("freight_id", cand.freight_id).eq("status", "PENDING");
    // Fecha frete
    await context.supabase.from("freights")
      .update({ status: "CLOSED", agreed_amount_in_cents: agreed })
      .eq("id", freight.id);

    // Cria viagem
    const { data: job, error: jErr } = await context.supabase.from("jobs").insert({
      freight_id: freight.id,
      provider_id: cand.provider_id,
      contractor_id: freight.contractor_id,
      agreed_amount_in_cents: agreed,
      status: "SCHEDULED",
    }).select("id").single();
    if (jErr) throw jErr;

    // Cria payment
    const fee = Math.round((agreed * SERVICE_FEE_BPS) / 10000);
    await context.supabase.from("payments").insert({
      job_id: job.id,
      amount_in_cents: agreed,
      service_fee_in_cents: fee,
      status: "PENDING",
      method: "PIX",
    });

    // Notifica motorista aceito + demais recusados
    const { notify, notifyMany } = await import("./notify.server");
    const { data: acceptedProv } = await context.supabase.from("providers").select("user_id").eq("id", cand.provider_id).maybeSingle();
    await notify(acceptedProv?.user_id, "🎉 Proposta aceita!", "Realize o pagamento para confirmar o motorista.", `/motorista/viagem/${job.id}`);
    const { data: others } = await context.supabase.from("candidacies")
      .select("provider_id,providers(user_id)").eq("freight_id", freight.id).eq("status", "WITHDRAWN");
    const rows = (others ?? [])
      .map((o: any) => ({ user_id: o.providers?.user_id, title: "Proposta recusada", body: "O embarcador escolheu outro motorista.", link: `/motorista/frete/${freight.id}` }))
      .filter((r) => r.user_id);
    await notifyMany(rows as any);

    return { job_id: job.id };
  });

// ============================================================
// PAGAMENTO (simulação)
// ============================================================
export const simulatePaymentPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ job_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: job } = await context.supabase.from("jobs")
      .select("id,contractor_id,provider_id,freights(title)").eq("id", data.job_id).maybeSingle();
    if (!job) throw new Error("Viagem não encontrada");
    const { data: c } = await context.supabase.from("contractors")
      .select("id,user_id").eq("id", job.contractor_id).eq("user_id", context.userId).maybeSingle();
    if (!c) throw new Error("Sem permissão");

    const { error } = await context.supabase.from("payments")
      .update({ status: "COMPLETED", paid_at: new Date().toISOString() })
      .eq("job_id", data.job_id);
    if (error) throw error;

    const { data: p } = await context.supabase.from("providers").select("user_id").eq("id", job.provider_id).maybeSingle();
    const { notifyMany } = await import("./notify.server");
    const title = (job as any).freights?.title ?? "sua viagem";
    await notifyMany([
      { user_id: c.user_id, title: "Pagamento confirmado", body: `O valor de ${title} está em custódia.`, link: `/embarcador/viagem/${data.job_id}` },
      ...(p?.user_id ? [{ user_id: p.user_id, title: "Pagamento confirmado ✓", body: "Você já pode gerar o código de coleta.", link: `/motorista/viagem/${data.job_id}` }] : []),
    ]);
    return { ok: true };
  });

// ============================================================
// CÓDIGOS DE COLETA / ENTREGA
// ============================================================
export const generatePickupCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ job_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: job } = await context.supabase.from("jobs")
      .select("id,status,contractor_id").eq("id", data.job_id).maybeSingle();
    if (!job) throw new Error("Viagem não encontrada");
    if (job.status !== "SCHEDULED") throw new Error("Viagem não está agendada");
    const { data: c } = await context.supabase.from("contractors")
      .select("id").eq("id", job.contractor_id).eq("user_id", context.userId).maybeSingle();
    if (!c) throw new Error("Sem permissão");
    const { data: pay } = await context.supabase.from("payments")
      .select("status").eq("job_id", job.id).maybeSingle();
    if (pay?.status !== "COMPLETED") throw new Error("Pagamento não confirmado");

    const code = makeCode();
    // remove anterior
    await context.supabase.from("check_ins").delete().eq("job_id", job.id).is("checked_in_at", null);
    const { error } = await context.supabase.from("check_ins").insert({ job_id: job.id, code });
    if (error) throw error;
    const { data: jj } = await context.supabase.from("jobs").select("provider_id,freights(title)").eq("id", job.id).maybeSingle();
    const { data: p } = jj ? await context.supabase.from("providers").select("user_id").eq("id", jj.provider_id).maybeSingle() : { data: null };
    const { notify } = await import("./notify.server");
    await notify(p?.user_id, "Código de coleta gerado", `Peça o código ao embarcador para confirmar a coleta de "${(jj as any)?.freights?.title ?? "sua viagem"}".`, `/motorista/viagem/${job.id}`);
    return { code };
  });

export const generateDeliveryCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ job_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: job } = await context.supabase.from("jobs")
      .select("id,status,contractor_id,provider_id").eq("id", data.job_id).maybeSingle();
    if (!job) throw new Error("Viagem não encontrada");
    if (job.status !== "IN_PROGRESS") throw new Error("Viagem não está em andamento");
    const { data: c } = await context.supabase.from("contractors")
      .select("id").eq("id", job.contractor_id).eq("user_id", context.userId).maybeSingle();
    if (!c) throw new Error("Sem permissão");
    const code = makeCode();
    await context.supabase.from("check_outs").delete().eq("job_id", job.id).is("checked_out_at", null);
    const { error } = await context.supabase.from("check_outs").insert({ job_id: job.id, code });
    if (error) throw error;
    const { data: p } = await context.supabase.from("providers").select("user_id").eq("id", job.provider_id).maybeSingle();
    const { notify } = await import("./notify.server");
    await notify(p?.user_id, "Código de entrega gerado", "Confirme a entrega com o código do destinatário.", `/motorista/viagem/${job.id}`);
    return { code };
  });

export const confirmPickup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ job_id: z.string().uuid(), code: z.string().length(6) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: job } = await context.supabase.from("jobs")
      .select("id,status,provider_id").eq("id", data.job_id).maybeSingle();
    if (!job) throw new Error("Viagem não encontrada");
    if (job.status !== "SCHEDULED") throw new Error("Viagem não está agendada");
    const { data: prov } = await context.supabase.from("providers")
      .select("id").eq("id", job.provider_id).eq("user_id", context.userId).maybeSingle();
    if (!prov) throw new Error("Sem permissão");
    const { data: ci } = await context.supabase.from("check_ins")
      .select("id,code").eq("job_id", job.id).is("checked_in_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ci || ci.code !== data.code.toUpperCase()) throw new Error("Código inválido");
    const now = new Date().toISOString();
    await context.supabase.from("check_ins").update({ validated_at: now, checked_in_at: now }).eq("id", ci.id);
    await context.supabase.from("jobs").update({ status: "IN_PROGRESS", started_at: now }).eq("id", job.id);
    await context.supabase.from("trip_events").insert([
      { job_id: job.id, type: "LOADING_FINISHED", created_by: context.userId },
      { job_id: job.id, type: "TRIP_STARTED", created_by: context.userId },
    ]);
    return { ok: true };
  });

export const confirmDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ job_id: z.string().uuid(), code: z.string().length(6) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: job } = await context.supabase.from("jobs")
      .select("id,status,provider_id,contractor_id,freights(title)").eq("id", data.job_id).maybeSingle();
    if (!job) throw new Error("Viagem não encontrada");
    if (job.status !== "IN_PROGRESS") throw new Error("Viagem não está em andamento");
    const { data: prov } = await context.supabase.from("providers")
      .select("id,user_id").eq("id", job.provider_id).eq("user_id", context.userId).maybeSingle();
    if (!prov) throw new Error("Sem permissão");
    const { data: co } = await context.supabase.from("check_outs")
      .select("id,code").eq("job_id", job.id).is("checked_out_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!co || co.code !== data.code.toUpperCase()) throw new Error("Código inválido");
    const now = new Date().toISOString();
    await context.supabase.from("check_outs").update({ validated_at: now, checked_out_at: now }).eq("id", co.id);
    await context.supabase.from("jobs").update({ status: "COMPLETED", ended_at: now }).eq("id", job.id);
    await context.supabase.from("trip_events").insert({ job_id: job.id, type: "UNLOADING_FINISHED", created_by: context.userId });

    const { data: c } = await context.supabase.from("contractors").select("user_id").eq("id", job.contractor_id).maybeSingle();
    const { notifyMany } = await import("./notify.server");
    const title = (job as any).freights?.title ?? "sua viagem";
    await notifyMany([
      ...(c?.user_id ? [{ user_id: c.user_id, title: "Viagem concluída ✓", body: `${title} foi entregue.`, link: `/embarcador/viagem/${job.id}` }] : []),
      { user_id: prov.user_id, title: "Viagem concluída ✓", body: "O pagamento será liberado em breve.", link: `/motorista/viagem/${job.id}` },
    ]);
    return { ok: true };
  });

// ============================================================
// CANCELAMENTO
// ============================================================
export const cancelFreight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ freight_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: freight } = await context.supabase.from("freights")
      .select("id,contractor_id,status").eq("id", data.freight_id).maybeSingle();
    if (!freight) throw new Error("Frete não encontrado");
    const { data: c } = await context.supabase.from("contractors")
      .select("id").eq("id", freight.contractor_id).eq("user_id", context.userId).maybeSingle();
    if (!c) throw new Error("Sem permissão");
    if (freight.status === "CLOSED") {
      // só se viagem ainda SCHEDULED
      const { data: job } = await context.supabase.from("jobs")
        .select("id,status").eq("freight_id", freight.id).maybeSingle();
      if (job && job.status !== "SCHEDULED") throw new Error("Já coletado, não pode cancelar");
      if (job) await context.supabase.from("jobs").update({ status: "CANCELLED" }).eq("id", job.id);
    }
    await context.supabase.from("freights").update({ status: "CANCELLED_BY_CONTRACTOR" }).eq("id", freight.id);
    await context.supabase.from("candidacies").update({ status: "CANCELLED_BY_CONTRACTOR" })
      .eq("freight_id", freight.id).in("status", ["PENDING", "ACCEPTED"]);
    return { ok: true };
  });

export const driverWithdrawFromJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ job_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: job } = await context.supabase.from("jobs")
      .select("id,status,freight_id,provider_id").eq("id", data.job_id).maybeSingle();
    if (!job || job.status !== "SCHEDULED") throw new Error("Só pode desistir antes da coleta");
    const { data: prov } = await context.supabase.from("providers")
      .select("id").eq("id", job.provider_id).eq("user_id", context.userId).maybeSingle();
    if (!prov) throw new Error("Sem permissão");
    // Reabre frete
    await context.supabase.from("jobs").update({ status: "CANCELLED" }).eq("id", job.id);
    await context.supabase.from("freights").update({ status: "OPEN", agreed_amount_in_cents: null }).eq("id", job.freight_id);
    await context.supabase.from("candidacies").update({ status: "WITHDRAWN" })
      .eq("freight_id", job.freight_id).eq("provider_id", prov.id).eq("status", "ACCEPTED");
    return { ok: true };
  });

// ============================================================
// AVALIAÇÃO
// ============================================================
export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    job_id: z.string().uuid(),
    role: z.enum(["PROVIDER", "CONTRACTOR"]),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: job } = await context.supabase.from("jobs")
      .select("id,status,provider_id,contractor_id").eq("id", data.job_id).maybeSingle();
    if (!job || job.status !== "COMPLETED") throw new Error("Viagem não concluída");
    const { error } = await context.supabase.from("feedbacks").insert({
      job_id: data.job_id,
      author_id: context.userId,
      role: data.role,
      rating: data.rating,
      comment: data.comment ?? null,
    });
    if (error) {
      if (error.code === "23505") throw new Error("Você já avaliou esta viagem");
      throw error;
    }
    return { ok: true };
  });

// ============================================================
// CRIAR PERFIL (após signup)
// ============================================================
const contractorProfileInput = z.object({
  company_name: z.string().min(1),
  corporate_reason: z.string().min(1),
  cnpj: z.string().min(14),
  cpf: z.string().min(11),
  contact_name: z.string().min(1),
  contact_email: z.string().email(),
  contact_phone: z.string().min(8),
  is_company_partner: z.boolean(),
  segment: z.string().min(1),
  monthly_freight_volume: z.string().min(1),
});
export const createContractorProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => contractorProfileInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error: rErr } = await context.supabase.from("user_roles").insert({
      user_id: context.userId, role: "contractor",
    });
    if (rErr && rErr.code !== "23505") throw rErr;
    const { error } = await context.supabase.from("contractors").insert({
      user_id: context.userId,
      company_name: data.company_name,
      corporate_reason: data.corporate_reason,
      cnpj: data.cnpj.replace(/\D/g, ""),
      cpf: data.cpf.replace(/\D/g, ""),
      contact_name: data.contact_name,
      contact_email: data.contact_email,
      contact_phone: data.contact_phone,
      is_company_partner: data.is_company_partner,
      segment: data.segment,
      monthly_freight_volume: data.monthly_freight_volume,
      validation_status: "PENDING_VALIDATION",
    });
    if (error) throw error;
    return { ok: true };
  });

const providerProfileInput = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(8),
  cpf: z.string().min(11),
  birthdate: z.string(),
  cnh_number: z.string().min(1),
  cnh_category: z.enum(["C", "D", "E"]),
  cnh_expires_at: z.string(),
  city: z.string().min(1),
  uf: z.string().length(2),
  vehicle: z.object({
    vehicle_type: z.string().min(1),
    body_type: z.string().min(1),
    plate: z.string().min(7),
    capacity_kg: z.number().int().positive(),
  }),
  cnh_document_url: z.string().min(1),
  cnh_back_url: z.string().min(1),
  address_proof_url: z.string().min(1),
  selfie_url: z.string().optional().nullable(),
  bank_code: z.string().min(1),
  bank_agency: z.string().min(1),
  bank_account: z.string().min(1),
  pix_key: z.string().min(1),
  pix_key_type: z.enum(["cpf", "email", "phone", "random"]),
});
export const createProviderProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => providerProfileInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error: rErr } = await context.supabase.from("user_roles").insert({
      user_id: context.userId, role: "provider",
    });
    if (rErr && rErr.code !== "23505") throw rErr;
    const { data: p, error } = await context.supabase.from("providers").insert({
      user_id: context.userId,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone,
      cpf: data.cpf.replace(/\D/g, ""),
      birthdate: data.birthdate,
      cnh_number: data.cnh_number,
      cnh_category: data.cnh_category,
      cnh_expires_at: data.cnh_expires_at,
      city: data.city,
      uf: data.uf,
      cnh_document_url: data.cnh_document_url,
      cnh_back_url: data.cnh_back_url,
      address_proof_url: data.address_proof_url,
      selfie_url: data.selfie_url ?? null,
      bank_code: data.bank_code,
      bank_agency: data.bank_agency,
      bank_account: data.bank_account,
      pix_key: data.pix_key,
      pix_key_type: data.pix_key_type,
      validation_status: "PENDING_VALIDATION",
    }).select("id").single();
    if (error) throw error;
    const { error: vErr } = await context.supabase.from("vehicles").insert({
      provider_id: p.id,
      vehicle_type: data.vehicle.vehicle_type,
      body_type: data.vehicle.body_type,
      plate: data.vehicle.plate.toUpperCase(),
      capacity_kg: data.vehicle.capacity_kg,
    });
    if (vErr) throw vErr;
    return { ok: true };
  });

export const resendProviderDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    cnh_document_url: z.string().min(1),
    cnh_back_url: z.string().min(1),
    address_proof_url: z.string().min(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from("providers")
      .select("id,validation_status").eq("user_id", context.userId).maybeSingle();
    if (!p) throw new Error("Motorista não encontrado");
    if (p.validation_status !== "REJECTED") throw new Error("Só é possível reenviar quando o cadastro foi recusado");
    const { error } = await context.supabase.from("providers").update({
      cnh_document_url: data.cnh_document_url,
      cnh_back_url: data.cnh_back_url,
      address_proof_url: data.address_proof_url,
      validation_status: "PENDING_VALIDATION",
      validation_notes: null,
    }).eq("id", p.id);
    if (error) throw error;
    return { ok: true };
  });

export const addVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    vehicle_type: z.string(),
    body_type: z.string(),
    plate: z.string().min(7),
    capacity_kg: z.number().int().positive(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from("providers")
      .select("id").eq("user_id", context.userId).maybeSingle();
    if (!p) throw new Error("Motorista não encontrado");
    const { error } = await context.supabase.from("vehicles").insert({
      provider_id: p.id,
      vehicle_type: data.vehicle_type,
      body_type: data.body_type,
      plate: data.plate.toUpperCase(),
      capacity_kg: data.capacity_kg,
    });
    if (error) throw error;
    return { ok: true };
  });

// ============================================================
// PUBLIC STATS (landing page aggregates)
// ============================================================
export const publicStats = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [openFreights, drivers, kmRows, gmvRows] = await Promise.all([
    supabaseAdmin.from("freights").select("id", { count: "exact", head: true }).eq("status", "OPEN"),
    supabaseAdmin.from("providers").select("id", { count: "exact", head: true }).or("is_banned.is.null,is_banned.eq.false"),
    supabaseAdmin.from("jobs").select("status,freights(distance_km)").eq("status", "COMPLETED"),
    supabaseAdmin.from("jobs").select("agreed_amount_in_cents").eq("status", "COMPLETED"),
  ]);
  const total_km = (kmRows.data ?? []).reduce((s: number, r: any) => s + (r.freights?.distance_km ?? 0), 0);
  const gmv_cents = (gmvRows.data ?? []).reduce((s: number, r: any) => s + (r.agreed_amount_in_cents ?? 0), 0);
  return {
    open_freights: openFreights.count ?? 0,
    drivers: drivers.count ?? 0,
    total_km,
    gmv_cents,
  };
});
