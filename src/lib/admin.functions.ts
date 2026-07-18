import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function requireAdmin(context: any, opts: { super?: boolean } = {}) {
  const { data: admin, error } = await context.supabase
    .from("admins").select("*").eq("user_id", context.userId).maybeSingle();
  if (error || !admin || !admin.is_active) throw new Error("Acesso negado");
  if (opts.super && admin.role !== "SUPER_ADMIN") throw new Error("Requer SUPER_ADMIN");
  return admin as { id: string; user_id: string; name: string; email: string; role: "ADMIN" | "SUPER_ADMIN"; is_active: boolean };
}

async function audit(context: any, adminId: string, action: string, entity_type: string, entity_id: string | null, details: Record<string, unknown> = {}) {
  await context.supabase.from("admin_audit_logs").insert({
    admin_id: adminId, action, entity_type, entity_id, details,
  });
}

// ================ ME ================
export const adminMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("admins").select("*").eq("user_id", context.userId).maybeSingle();
    if (!data || !data.is_active) return null;
    return data;
  });

// ================ DASHBOARD ================
export const adminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const s = context.supabase;

    const [openFreights, inProgress, pendingValidation, gmvMonth, escrow, allJobs30, weeklyJobs, oldInProgress, oldPending] = await Promise.all([
      s.from("freights").select("id", { count: "exact", head: true }).eq("status", "OPEN"),
      s.from("jobs").select("id", { count: "exact", head: true }).eq("status", "IN_PROGRESS"),
      s.from("contractors").select("id", { count: "exact", head: true }).eq("validation_status", "PENDING_VALIDATION"),
      s.from("jobs").select("agreed_amount_in_cents").eq("status", "COMPLETED").gte("ended_at", startOfMonth()),
      s.from("payments").select("amount_in_cents,job_id,status,jobs!inner(status)").in("status", ["HELD","COMPLETED"]),
      s.from("freights").select("created_at").gte("created_at", daysAgo(30)),
      s.from("jobs").select("status,updated_at,ended_at").gte("updated_at", daysAgo(84)).in("status", ["COMPLETED","CANCELLED"]),
      s.from("jobs").select("id,started_at,freight_id,contractor_id,provider_id").eq("status", "IN_PROGRESS").lt("started_at", daysAgo(7)),
      s.from("payments").select("id,status,created_at,job_id").eq("status", "PENDING").lt("created_at", hoursAgo(48)),
    ]);

    const gmvMonthCents = (gmvMonth.data ?? []).reduce((a: number, r: any) => a + (r.agreed_amount_in_cents ?? 0), 0);
    const revenueMonthCents = Math.round(gmvMonthCents * 0.10);
    const escrowCents = (escrow.data ?? []).filter((r: any) => r.jobs?.status !== "COMPLETED").reduce((a: number, r: any) => a + r.amount_in_cents, 0);

    // Fretes por dia (30d)
    const perDay: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); perDay[d.toISOString().slice(0, 10)] = 0; }
    for (const r of (allJobs30.data ?? []) as any[]) { const k = r.created_at.slice(0, 10); if (k in perDay) perDay[k]++; }

    // Semanas (12)
    const perWeek: Record<string, { completed: number; cancelled: number }> = {};
    for (let i = 11; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i * 7); perWeek[isoWeek(d)] = { completed: 0, cancelled: 0 }; }
    for (const r of (weeklyJobs.data ?? []) as any[]) {
      const k = isoWeek(new Date(r.updated_at));
      if (!(k in perWeek)) continue;
      if (r.status === "COMPLETED") perWeek[k].completed++;
      else if (r.status === "CANCELLED") perWeek[k].cancelled++;
    }

    return {
      kpis: {
        openFreights: openFreights.count ?? 0,
        inProgress: inProgress.count ?? 0,
        pendingValidation: pendingValidation.count ?? 0,
        gmvMonthCents,
        revenueMonthCents,
        escrowCents,
      },
      freightsPerDay: Object.entries(perDay).map(([date, count]) => ({ date, count })),
      jobsPerWeek: Object.entries(perWeek).map(([week, v]) => ({ week, ...v })),
      pending: {
        contractorsPending: pendingValidation.count ?? 0,
        stuckJobs: oldInProgress.data ?? [],
        latePayments: oldPending.data ?? [],
      },
    };
  });

function startOfMonth() { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.toISOString(); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); }
function hoursAgo(n: number) { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString(); }
function isoWeek(d: Date) {
  const target = new Date(d.valueOf()); const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3); const firstThursday = target.valueOf();
  target.setMonth(0, 1); if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / (7 * 24 * 3600 * 1000));
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ================ VALIDATION ================
export const listValidationQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tab: z.enum(["PENDING_VALIDATION","APPROVED","REJECTED"]).default("PENDING_VALIDATION"), search: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    let q = context.supabase.from("contractors").select("*").eq("validation_status", data.tab).order("created_at", { ascending: true });
    if (data.search) q = q.or(`company_name.ilike.%${data.search}%,cnpj.ilike.%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const approveContractor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { error } = await context.supabase.from("contractors")
      .update({ validation_status: "APPROVED", validated_at: new Date().toISOString(), validation_notes: null })
      .eq("id", data.id);
    if (error) throw error;
    await audit(context, admin.id, "APPROVE_CONTRACTOR", "contractor", data.id);
    return { ok: true };
  });

export const rejectContractor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), reason: z.string().min(3).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { error } = await context.supabase.from("contractors")
      .update({ validation_status: "REJECTED", validation_notes: data.reason })
      .eq("id", data.id);
    if (error) throw error;
    await audit(context, admin.id, "REJECT_CONTRACTOR", "contractor", data.id, { reason: data.reason });
    return { ok: true };
  });

// ================ CONTRACTORS ================
export const listContractorsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    page: z.number().int().default(1),
    search: z.string().optional(),
    validation: z.string().optional(),
    uf: z.string().optional(),
    active: z.enum(["all","active","inactive"]).default("all"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const from = (data.page - 1) * 20; const to = from + 19;
    let q = context.supabase.from("contractors").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
    if (data.search) q = q.or(`company_name.ilike.%${data.search}%,cnpj.ilike.%${data.search}%,contact_email.ilike.%${data.search}%`);
    if (data.validation) q = q.eq("validation_status", data.validation as "PENDING_VALIDATION" | "APPROVED" | "REJECTED");
    if (data.uf) q = q.eq("uf", data.uf);
    if (data.active === "active") q = q.eq("is_active", true);
    if (data.active === "inactive") q = q.eq("is_active", false);
    const { data: rows, error, count } = await q;
    if (error) throw error;
    return { rows: rows ?? [], total: count ?? 0 };
  });

export const getContractorAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const s = context.supabase;
    const [c, freights, jobs, feedbacks, payments] = await Promise.all([
      s.from("contractors").select("*").eq("id", data.id).maybeSingle(),
      s.from("freights").select("*").eq("contractor_id", data.id).order("created_at", { ascending: false }).limit(50),
      s.from("jobs").select("*").eq("contractor_id", data.id).order("created_at", { ascending: false }).limit(50),
      s.from("feedbacks").select("*,jobs!inner(contractor_id)").eq("jobs.contractor_id", data.id).order("created_at", { ascending: false }).limit(20),
      s.from("payments").select("*,jobs!inner(contractor_id)").eq("jobs.contractor_id", data.id).order("created_at", { ascending: false }).limit(50),
    ]);
    return { contractor: c.data, freights: freights.data ?? [], jobs: jobs.data ?? [], feedbacks: feedbacks.data ?? [], payments: payments.data ?? [] };
  });

export const setContractorActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    await context.supabase.from("contractors").update({ is_active: data.is_active }).eq("id", data.id);
    await audit(context, admin.id, data.is_active ? "REACTIVATE_CONTRACTOR" : "DEACTIVATE_CONTRACTOR", "contractor", data.id);
    return { ok: true };
  });

// ================ PROVIDERS ================
export const listProvidersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    page: z.number().int().default(1),
    search: z.string().optional(),
    uf: z.string().optional(),
    cnh: z.string().optional(),
    active: z.enum(["all","active","inactive"]).default("all"),
    cnh_expired: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const from = (data.page - 1) * 20; const to = from + 19;
    let q = context.supabase.from("providers").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
    if (data.search) q = q.or(`full_name.ilike.%${data.search}%,cpf.ilike.%${data.search}%,email.ilike.%${data.search}%`);
    if (data.uf) q = q.eq("uf", data.uf);
    if (data.cnh) q = q.eq("cnh_category", data.cnh);
    if (data.active === "active") q = q.eq("is_active", true);
    if (data.active === "inactive") q = q.eq("is_active", false);
    if (data.cnh_expired) q = q.lt("cnh_expires_at", new Date().toISOString().slice(0, 10));
    const { data: rows, error, count } = await q;
    if (error) throw error;
    return { rows: rows ?? [], total: count ?? 0 };
  });

export const getProviderAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const s = context.supabase;
    const [p, vehicles, cands, jobs, feedbacks] = await Promise.all([
      s.from("providers").select("*").eq("id", data.id).maybeSingle(),
      s.from("vehicles").select("*").eq("provider_id", data.id),
      s.from("candidacies").select("*,freights(*)").eq("provider_id", data.id).order("created_at", { ascending: false }).limit(50),
      s.from("jobs").select("*").eq("provider_id", data.id).order("created_at", { ascending: false }).limit(50),
      s.from("feedbacks").select("*,jobs!inner(provider_id)").eq("jobs.provider_id", data.id).order("created_at", { ascending: false }).limit(20),
    ]);
    return { provider: p.data, vehicles: vehicles.data ?? [], candidacies: cands.data ?? [], jobs: jobs.data ?? [], feedbacks: feedbacks.data ?? [] };
  });

export const setProviderActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    await context.supabase.from("providers").update({ is_active: data.is_active }).eq("id", data.id);
    await audit(context, admin.id, data.is_active ? "REACTIVATE_PROVIDER" : "DEACTIVATE_PROVIDER", "provider", data.id);
    return { ok: true };
  });

export const banProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), reason: z.string().min(3).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    await context.supabase.from("providers").update({ is_active: false, is_banned: true, ban_reason: data.reason }).eq("id", data.id);
    await context.supabase.from("candidacies").update({ status: "WITHDRAWN" }).eq("provider_id", data.id).eq("status", "PENDING");
    await audit(context, admin.id, "BAN_PROVIDER", "provider", data.id, { reason: data.reason });
    return { ok: true };
  });

// ================ FREIGHTS ================
export const listFreightsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    tab: z.enum(["OPEN","CLOSED","CANCELLED"]).default("OPEN"),
    page: z.number().int().default(1),
    search: z.string().optional(),
    origin_uf: z.string().optional(),
    dest_uf: z.string().optional(),
    cargo: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const from = (data.page - 1) * 20; const to = from + 19;
    let q = context.supabase.from("freights").select("*,contractors(company_name,cnpj)", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
    if (data.tab === "OPEN") q = q.eq("status", "OPEN");
    else if (data.tab === "CLOSED") q = q.eq("status", "CLOSED");
    else q = q.in("status", ["CANCELLED","CANCELLED_BY_CONTRACTOR"]);
    if (data.search) q = q.or(`title.ilike.%${data.search}%,origin_city.ilike.%${data.search}%,destination_city.ilike.%${data.search}%`);
    if (data.origin_uf) q = q.eq("origin_uf", data.origin_uf);
    if (data.dest_uf) q = q.eq("destination_uf", data.dest_uf);
    if (data.cargo) q = q.eq("cargo_type", data.cargo);
    const { data: rows, error, count } = await q;
    if (error) throw error;
    // add proposal counts
    const ids = (rows ?? []).map((r: any) => r.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: cs } = await context.supabase.from("candidacies").select("freight_id").in("freight_id", ids);
      counts = (cs ?? []).reduce<Record<string, number>>((a: any, c: any) => { a[c.freight_id] = (a[c.freight_id] ?? 0) + 1; return a; }, {});
    }
    return { rows: (rows ?? []).map((r: any) => ({ ...r, proposals_count: counts[r.id] ?? 0 })), total: count ?? 0 };
  });

export const getFreightAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const s = context.supabase;
    const [f, cands, job, payment] = await Promise.all([
      s.from("freights").select("*,contractors(*)").eq("id", data.id).maybeSingle(),
      s.from("candidacies").select("*,providers(*),vehicles(*)").eq("freight_id", data.id).order("created_at", { ascending: false }),
      s.from("jobs").select("*").eq("freight_id", data.id).maybeSingle(),
      s.from("jobs").select("id,payments(*)").eq("freight_id", data.id).maybeSingle(),
    ]);
    return { freight: f.data, candidacies: cands.data ?? [], job: job.data, payment: (payment.data as any)?.payments?.[0] ?? null };
  });

export const adminCancelFreight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    reason: z.string().min(3).max(1000),
    refund_type: z.enum(["FULL","PARTIAL","NONE"]).default("NONE"),
    refund_amount_reais: z.number().nonnegative().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const s = context.supabase;
    const { data: freight } = await s.from("freights").select("*").eq("id", data.id).maybeSingle();
    if (!freight) throw new Error("Frete não encontrado");
    const { data: job } = await s.from("jobs").select("*").eq("freight_id", data.id).maybeSingle();
    if (job && (job.status === "IN_PROGRESS" || job.status === "COMPLETED")) throw new Error("Viagem já está em andamento ou concluída");
    let refundCents = 0;
    if (data.refund_type === "PARTIAL") refundCents = Math.round((data.refund_amount_reais ?? 0) * 100);
    if (data.refund_type === "FULL" && job) refundCents = job.agreed_amount_in_cents;

    await s.from("freights").update({ status: "CANCELLED" }).eq("id", data.id);
    await s.from("candidacies").update({ status: "WITHDRAWN" }).eq("freight_id", data.id).in("status", ["PENDING","ACCEPTED"]);
    if (job) {
      await s.from("jobs").update({ status: "CANCELLED" }).eq("id", job.id);
      if (data.refund_type !== "NONE") {
        await s.from("payments").update({ status: "REFUNDED", refunded_at: new Date().toISOString(), refund_reason: data.reason }).eq("job_id", job.id);
      }
    }
    await s.from("admin_freight_cancellations").insert({
      freight_id: data.id, admin_id: admin.id, reason: data.reason,
      refund_type: data.refund_type, refund_amount_cents: refundCents,
    });
    await audit(context, admin.id, "CANCEL_FREIGHT", "freight", data.id, { reason: data.reason, refund_type: data.refund_type, refund_amount_cents: refundCents });
    return { ok: true };
  });

export const reopenFreight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const s = context.supabase;
    const { data: freight } = await s.from("freights").select("*").eq("id", data.id).maybeSingle();
    if (!freight || freight.status !== "CLOSED") throw new Error("Frete não está fechado");
    const { data: job } = await s.from("jobs").select("*").eq("freight_id", data.id).maybeSingle();
    if (!job || job.status !== "SCHEDULED") throw new Error("Viagem já iniciada");
    const { data: pay } = await s.from("payments").select("*").eq("job_id", job.id).maybeSingle();
    if (pay && pay.status === "COMPLETED") throw new Error("Já existe pagamento em custódia");

    if (pay) await s.from("payments").delete().eq("id", pay.id);
    await s.from("jobs").delete().eq("id", job.id);
    await s.from("candidacies").update({ status: "PENDING" }).eq("freight_id", data.id).in("status", ["ACCEPTED","WITHDRAWN"]);
    await s.from("freights").update({ status: "OPEN", agreed_amount_in_cents: null }).eq("id", data.id);
    await audit(context, admin.id, "REOPEN_FREIGHT", "freight", data.id);
    return { ok: true };
  });

// ================ JOBS ================
export const listJobsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    tab: z.enum(["SCHEDULED","IN_PROGRESS","COMPLETED","CANCELLED"]).default("SCHEDULED"),
    page: z.number().int().default(1),
    search: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const from = (data.page - 1) * 20; const to = from + 19;
    const { data: rows, error, count } = await context.supabase
      .from("jobs")
      .select("*,freights(title,origin_city,origin_uf,destination_city,destination_uf,pickup_at),providers(full_name),contractors(company_name),payments(status,amount_in_cents,released_at)", { count: "exact" })
      .eq("status", data.tab)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return { rows: rows ?? [], total: count ?? 0 };
  });

export const getJobAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const s = context.supabase;
    const [job, checkIn, checkOut, payment, feedbacks] = await Promise.all([
      s.from("jobs").select("*,freights(*),providers(*),contractors(*)").eq("id", data.id).maybeSingle(),
      s.from("check_ins").select("*").eq("job_id", data.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      s.from("check_outs").select("*").eq("job_id", data.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      s.from("payments").select("*").eq("job_id", data.id).maybeSingle(),
      s.from("feedbacks").select("*").eq("job_id", data.id),
    ]);
    return { job: job.data, checkIn: checkIn.data, checkOut: checkOut.data, payment: payment.data, feedbacks: feedbacks.data ?? [] };
  });

export const forceCompleteJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), reason: z.string().min(3).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { data: job } = await context.supabase.from("jobs").select("disputed,provider_id,contractor_id").eq("id", data.id).maybeSingle();
    if (job?.disputed) throw new Error("Viagem em disputa. Encerre a disputa antes de forçar a conclusão.");
    const now = new Date().toISOString();
    await context.supabase.from("jobs").update({ status: "COMPLETED", ended_at: now, force_completed_by: admin.id, force_completed_reason: data.reason }).eq("id", data.id);
    await context.supabase.from("payments").update({ status: "RELEASED", released_at: now }).eq("job_id", data.id).eq("status", "COMPLETED");
    await audit(context, admin.id, "FORCE_COMPLETE_JOB", "job", data.id, { reason: data.reason });
    if (job) {
      const [{ data: p }, { data: c }] = await Promise.all([
        context.supabase.from("providers").select("user_id").eq("id", job.provider_id).maybeSingle(),
        context.supabase.from("contractors").select("user_id").eq("id", job.contractor_id).maybeSingle(),
      ]);
      const { notifyMany } = await import("./notify.server");
      await notifyMany([
        ...(p?.user_id ? [{ user_id: p.user_id, title: "Pagamento liberado ✓", body: "Sua viagem foi concluída pelo admin e o pagamento foi liberado.", link: `/motorista/viagem/${data.id}` }] : []),
        ...(c?.user_id ? [{ user_id: c.user_id, title: "Viagem finalizada pelo admin", body: data.reason, link: `/embarcador/viagem/${data.id}` }] : []),
      ]);
    }
    return { ok: true };
  });

export const cancelJobAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(), reason: z.string().min(3).max(1000),
    refund_type: z.enum(["FULL","PARTIAL","NONE"]).default("FULL"),
    refund_amount_reais: z.number().nonnegative().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const s = context.supabase;
    const { data: job } = await s.from("jobs").select("*").eq("id", data.id).maybeSingle();
    if (!job || job.status !== "SCHEDULED") throw new Error("Só é possível cancelar viagens agendadas");
    await s.from("jobs").update({ status: "CANCELLED" }).eq("id", data.id);
    if (data.refund_type !== "NONE") {
      await s.from("payments").update({ status: "REFUNDED", refunded_at: new Date().toISOString(), refund_reason: data.reason }).eq("job_id", data.id);
    }
    try {
      const { documentProvider } = await import("./document-emission.server");
      await documentProvider.cancelDocuments(data.id);
    } catch (e) { console.error("[documents] cancel falhou", e); }
    await audit(context, admin.id, "CANCEL_JOB", "job", data.id, { reason: data.reason, refund_type: data.refund_type });
    return { ok: true };
  });

export const toggleJobDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), disputed: z.boolean(), notes: z.string().max(2000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    await context.supabase.from("jobs").update({ disputed: data.disputed, dispute_notes: data.notes ?? null }).eq("id", data.id);
    await audit(context, admin.id, data.disputed ? "OPEN_DISPUTE" : "CLOSE_DISPUTE", "job", data.id, { notes: data.notes });
    return { ok: true };
  });

// ================ PAYMENTS ================
export const listPaymentsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    status: z.enum(["ALL","PENDING","COMPLETED","RELEASED","REFUNDED"]).default("ALL"),
    page: z.number().int().default(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const from = (data.page - 1) * 20; const to = from + 19;
    let q = context.supabase.from("payments")
      .select("*,jobs!inner(id,freights(origin_city,origin_uf,destination_city,destination_uf),providers(full_name),contractors(company_name))", { count: "exact" })
      .order("created_at", { ascending: false }).range(from, to);
    if (data.status !== "ALL") q = q.eq("status", data.status);
    const { data: rows, error, count } = await q;
    if (error) throw error;
    return { rows: rows ?? [], total: count ?? 0 };
  });

export const paymentsSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const s = context.supabase;
    const monthStart = (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.toISOString(); })();
    const [escrow, released, refunded] = await Promise.all([
      s.from("payments").select("amount_in_cents,jobs!inner(status)").eq("status", "COMPLETED"),
      s.from("payments").select("amount_in_cents").eq("status", "RELEASED").gte("released_at", monthStart),
      s.from("payments").select("amount_in_cents").eq("status", "REFUNDED").gte("refunded_at", monthStart),
    ]);
    return {
      escrowCents: (escrow.data ?? []).filter((r: any) => r.jobs?.status !== "COMPLETED").reduce((a: number, r: any) => a + r.amount_in_cents, 0),
      releasedMonthCents: (released.data ?? []).reduce((a: number, r: any) => a + r.amount_in_cents, 0),
      refundedMonthCents: (refunded.data ?? []).reduce((a: number, r: any) => a + r.amount_in_cents, 0),
    };
  });

export const releasePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { data: pay } = await context.supabase.from("payments").select("job_id,jobs(disputed,provider_id)").eq("id", data.id).maybeSingle();
    if ((pay as any)?.jobs?.disputed) throw new Error("Viagem em disputa. Encerre a disputa antes de liberar o pagamento.");
    await context.supabase.from("payments").update({ status: "RELEASED", released_at: new Date().toISOString() }).eq("id", data.id);
    await audit(context, admin.id, "RELEASE_PAYMENT", "payment", data.id);
    if (pay) {
      const { data: p } = await context.supabase.from("providers").select("user_id").eq("id", (pay as any).jobs?.provider_id).maybeSingle();
      const { notify } = await import("./notify.server");
      await notify(p?.user_id, "Pagamento liberado ✓", "Seu pagamento foi transferido via PIX.", `/motorista/viagem/${pay.job_id}`);
    }
    return { ok: true };
  });

export const refundPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), reason: z.string().min(3).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { data: pay } = await context.supabase.from("payments").select("job_id,jobs(provider_id,contractor_id)").eq("id", data.id).maybeSingle();
    await context.supabase.from("payments").update({ status: "REFUNDED", refunded_at: new Date().toISOString(), refund_reason: data.reason }).eq("id", data.id);
    await audit(context, admin.id, "REFUND_PAYMENT", "payment", data.id, { reason: data.reason });
    if (pay) {
      const j = (pay as any).jobs;
      const [{ data: p }, { data: c }] = await Promise.all([
        context.supabase.from("providers").select("user_id").eq("id", j?.provider_id).maybeSingle(),
        context.supabase.from("contractors").select("user_id").eq("id", j?.contractor_id).maybeSingle(),
      ]);
      const { notifyMany } = await import("./notify.server");
      await notifyMany([
        ...(p?.user_id ? [{ user_id: p.user_id, title: "Pagamento estornado", body: data.reason, link: `/motorista/viagem/${pay.job_id}` }] : []),
        ...(c?.user_id ? [{ user_id: c.user_id, title: "Pagamento estornado", body: data.reason, link: `/embarcador/viagem/${pay.job_id}` }] : []),
      ]);
    }
    return { ok: true };
  });

// ================ FEEDBACKS ================
export const listFeedbacksAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    rating: z.number().int().min(1).max(5).optional(),
    role: z.enum(["PROVIDER","CONTRACTOR"]).optional(),
    hidden: z.enum(["all","visible","hidden"]).default("all"),
    page: z.number().int().default(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const from = (data.page - 1) * 20; const to = from + 19;
    let q = context.supabase.from("feedbacks")
      .select("*,jobs(id,freights(origin_city,origin_uf,destination_city,destination_uf))", { count: "exact" })
      .order("created_at", { ascending: false }).range(from, to);
    if (data.rating) q = q.eq("rating", data.rating);
    if (data.role) q = q.eq("role", data.role);
    if (data.hidden === "hidden") q = q.eq("hidden", true);
    if (data.hidden === "visible") q = q.eq("hidden", false);
    const { data: rows, error, count } = await q;
    if (error) throw error;
    return { rows: rows ?? [], total: count ?? 0 };
  });

export const hideFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), reason: z.string().min(3).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    await context.supabase.from("feedbacks").update({ hidden: true, hidden_reason: data.reason }).eq("id", data.id);
    await audit(context, admin.id, "HIDE_FEEDBACK", "feedback", data.id, { reason: data.reason });
    return { ok: true };
  });

export const unhideFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    await context.supabase.from("feedbacks").update({ hidden: false, hidden_reason: null }).eq("id", data.id);
    await audit(context, admin.id, "UNHIDE_FEEDBACK", "feedback", data.id);
    return { ok: true };
  });

// ================ AUDIT ================
export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    admin_id: z.string().uuid().optional(),
    action: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.number().int().default(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const from = (data.page - 1) * 20; const to = from + 19;
    let q = context.supabase.from("admin_audit_logs")
      .select("*,admins(name,email)", { count: "exact" })
      .order("created_at", { ascending: false }).range(from, to);
    if (data.admin_id) q = q.eq("admin_id", data.admin_id);
    if (data.action) q = q.ilike("action", `%${data.action}%`);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error, count } = await q;
    if (error) throw error;
    return { rows: rows ?? [], total: count ?? 0 };
  });

// ================ TEAM (SUPER_ADMIN) ================
export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context, { super: true });
    const { data } = await context.supabase.from("admins").select("*").order("created_at", { ascending: false });
    return data ?? [];
  });

export const createAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    email: z.string().email(), name: z.string().min(2),
    role: z.enum(["ADMIN","SUPER_ADMIN"]).default("ADMIN"),
    password: z.string().min(8),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context, { super: true });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user, error: userErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { full_name: data.name },
    });
    if (userErr) throw userErr;
    const { error } = await supabaseAdmin.from("admins").insert({
      user_id: user.user!.id, email: data.email, name: data.name, role: data.role, is_active: true,
    });
    if (error) throw error;
    await audit(context, admin.id, "CREATE_ADMIN", "admin", user.user!.id, { email: data.email, role: data.role });
    return { ok: true };
  });

export const setAdminActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context, { super: true });
    await context.supabase.from("admins").update({ is_active: data.is_active }).eq("id", data.id);
    await audit(context, admin.id, data.is_active ? "REACTIVATE_ADMIN" : "DEACTIVATE_ADMIN", "admin", data.id);
    return { ok: true };
  });

// ================ REJECTED CONTRACTOR REAPPLY (used by contractor) ================
export const contractorResubmitValidation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: c } = await context.supabase.from("contractors").select("id,user_id").eq("user_id", context.userId).maybeSingle();
    if (!c) throw new Error("Cadastro não encontrado");
    await context.supabase.from("contractors").update({ validation_status: "PENDING_VALIDATION", validation_notes: null }).eq("id", c.id);
    return { ok: true };
  });

// ================ BOOTSTRAP (only works when zero admins) ================
export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await context.supabase.from("admins").select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) throw new Error("Já existem admins configurados");
    const { data: user } = await context.supabase.auth.getUser();
    const email = user.user?.email ?? "";
    const name = (user.user?.user_metadata as any)?.full_name ?? email.split("@")[0];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("admins").insert({
      user_id: context.userId, email, name, role: "SUPER_ADMIN", is_active: true,
    });
    if (error) throw error;
    return { ok: true };
  });

// ================ PROVIDER VALIDATION ================
export const listProviderValidationQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    tab: z.enum(["PENDING_VALIDATION","APPROVED","REJECTED"]).default("PENDING_VALIDATION"),
    search: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    let q = context.supabase.from("providers")
      .select("*, vehicles(id,vehicle_type,body_type,plate,capacity_kg)")
      .eq("validation_status", data.tab)
      .order("created_at", { ascending: true });
    if (data.search) q = q.or(`full_name.ilike.%${data.search}%,cpf.ilike.%${data.search}%,email.ilike.%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const countProviderValidationPending = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { count } = await context.supabase.from("providers")
      .select("id", { count: "exact", head: true })
      .eq("validation_status", "PENDING_VALIDATION");
    return count ?? 0;
  });

export const approveProviderValidation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { error } = await context.supabase.from("providers")
      .update({ validation_status: "APPROVED", validated_at: new Date().toISOString(), validation_notes: null })
      .eq("id", data.id);
    if (error) throw error;
    await audit(context, admin.id, "APPROVE_PROVIDER", "provider", data.id);
    return { ok: true };
  });

export const rejectProviderValidation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), reason: z.string().min(3).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { error } = await context.supabase.from("providers")
      .update({ validation_status: "REJECTED", validation_notes: data.reason })
      .eq("id", data.id);
    if (error) throw error;
    await audit(context, admin.id, "REJECT_PROVIDER", "provider", data.id, { reason: data.reason });
    return { ok: true };
  });

export const adminSignDriverDocUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: signed, error } = await context.supabase.storage
      .from("driver-documents").createSignedUrl(data.path, 300);
    if (error) throw error;
    return { url: signed.signedUrl };
  });
