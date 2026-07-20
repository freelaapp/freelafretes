import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---- Motorista: extrato de repasse do frete ----
export const getDriverPayout = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ job_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase
      .from("driver_payouts")
      .select("*")
      .eq("job_id", data.job_id)
      .maybeSingle();
    return p;
  });

// ---- Embarcador: minhas faturas ----
export const listMyInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: c } = await context.supabase
      .from("contractors").select("id").eq("user_id", context.userId).maybeSingle();
    if (!c) return [];
    const { data } = await context.supabase
      .from("invoices")
      .select("id,job_id,amount_cents,icms_cents,issued_at,pdf_ready,jobs(id,freights(title,origin_city,origin_uf,destination_city,destination_uf))")
      .eq("shipper_id", c.id)
      .order("issued_at", { ascending: false });
    return data ?? [];
  });

// ---- Embarcador: fatura individual (para tela imprimível) ----
export const getMyInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: c } = await context.supabase
      .from("contractors").select("*").eq("user_id", context.userId).maybeSingle();
    if (!c) throw new Error("Perfil de embarcador não encontrado");
    const { data: inv } = await context.supabase
      .from("invoices")
      .select(`
        id,job_id,amount_cents,icms_cents,issued_at,pdf_ready,
        jobs(
          id,agreed_amount_in_cents,started_at,ended_at,
          freights(title,origin_city,origin_uf,destination_city,destination_uf,cargo_type,weight_kg,freight_mode),
          providers(full_name,cpf,vehicles(plate,vehicle_type))
        )
      `)
      .eq("id", data.id)
      .eq("shipper_id", c.id)
      .maybeSingle();
    if (!inv) throw new Error("Fatura não encontrada");
    const { data: docs } = await context.supabase
      .from("freight_documents")
      .select("id,doc_type,doc_number,access_key,status,event_type,issued_at")
      .eq("job_id", inv.job_id)
      .order("issued_at", { ascending: true });
    return { invoice: inv, shipper: c, documents: docs ?? [] };
  });

// ---- Admin: relatório mensal de retenções ----
export const adminWithholdingsReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    from: z.string(), to: z.string(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.from("admins").select("*").eq("user_id", context.userId).maybeSingle();
    if (!admin || !admin.is_active) throw new Error("Acesso negado");
    const { data: rows } = await context.supabase
      .from("driver_payouts")
      .select("gross_cents,inss_cents,sest_senat_cents,net_cents,paid_at,providers(full_name,cpf)")
      .eq("status", "PAID")
      .gte("paid_at", data.from)
      .lte("paid_at", data.to)
      .order("paid_at", { ascending: false });
    const list = rows ?? [];
    const totals = list.reduce((acc, r: any) => ({
      gross: acc.gross + (r.gross_cents ?? 0),
      inss: acc.inss + (r.inss_cents ?? 0),
      sest: acc.sest + (r.sest_senat_cents ?? 0),
      net: acc.net + (r.net_cents ?? 0),
      count: acc.count + 1,
    }), { gross: 0, inss: 0, sest: 0, net: 0, count: 0 });
    return { rows: list, totals };
  });
