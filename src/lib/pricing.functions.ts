import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import {
  calcularFrete,
  vehicleLabelToKey,
  DEFAULT_SETTINGS,
  DEFAULT_VEHICLE_COSTS,
  DEFAULT_CARGO_FACTORS,
  type PricingSettings,
  type VehicleCost,
  type PricingInput,
} from "./pricing";
import { anttFloor, type AnttRate } from "./antt-floor";
import { classifyFreight, type FreightMode } from "./freight-classifier";

// ============================================================
// Carrega toda a config e o contexto de mercado
// (usa admin client — service role — pois as tabelas de pricing
// não são mais legíveis por anon/authenticated diretamente)
// ============================================================
async function loadConfig(originUf?: string, vehicleType?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const s = supabaseAdmin;
  const [settingsQ, vcostsQ, cfactorsQ, anttQ] = await Promise.all([
    s.from("pricing_settings").select("settings").eq("id", 1).maybeSingle(),
    s.from("pricing_vehicle_costs").select("*"),
    s.from("pricing_cargo_factors").select("*"),
    s.from("antt_floor_rates").select("*"),
  ]);


  const settings: PricingSettings = { ...DEFAULT_SETTINGS, ...(settingsQ.data?.settings as any ?? {}) };
  const vehicleCosts: Record<string, VehicleCost> = { ...DEFAULT_VEHICLE_COSTS };
  for (const r of vcostsQ.data ?? []) {
    vehicleCosts[r.vehicle_type] = {
      vehicle_type: r.vehicle_type,
      ckm_cents_por_km: r.ckm_cents_por_km,
      frete_minimo_cents: r.frete_minimo_cents,
      capacidade_kg: r.capacidade_kg,
    };
  }
  const cargoFactors: Record<string, number> = { ...DEFAULT_CARGO_FACTORS };
  for (const r of cfactorsQ.data ?? []) cargoFactors[r.cargo_type] = Number(r.factor);

  const anttRates: AnttRate[] = (anttQ.data ?? []).map((r: any) => ({
    vehicle_axles: r.vehicle_axles,
    cargo_category: r.cargo_category,
    rate_per_km_cents: r.rate_per_km_cents,
    load_unload_cents: r.load_unload_cents ?? 0,
    valid_from: r.valid_from,
    valid_to: r.valid_to,
  }));

  // eixos por veículo (do catálogo)
  const axlesByVehicle: Record<string, number> = {};
  for (const r of vcostsQ.data ?? []) if (r.axles) axlesByVehicle[r.vehicle_type] = r.axles;

  // Contexto de mercado
  let fretesAbertosNaRota = 0;
  let motoristasAtivos = 0;
  if (originUf) {
    const { count } = await s.from("freights_public").select("id", { count: "exact", head: true })
      .eq("origin_uf", originUf);
    fretesAbertosNaRota = count ?? 0;
  }
  if (vehicleType) {
    const vKey = vehicleLabelToKey(vehicleType);
    const labels = Object.entries({
      vlc: "VLC", toco: "Toco", truck: "Truck", bitruck: "Bitruck",
      carreta: "Carreta", bitrem: "Bitrem", rodotrem: "Rodotrem",
    } as Record<string, string>).find(([k]) => k === vKey)?.[1];
    if (labels) {
      const { count } = await s.from("providers").select("id", { count: "exact", head: true })
        .eq("is_active", true);
      motoristasAtivos = count ?? 0;
      void labels;
    }
  }
  return { settings, vehicleCosts, cargoFactors, anttRates, axlesByVehicle, fretesAbertosNaRota, motoristasAtivos };
}

// Helper reutilizável para computar piso ANTT server-side
export async function computeAnttFloor(args: {
  vehicle_type: string; cargo_type: string; distance_km: number;
  freight_mode: FreightMode; peso_kg?: number; volume_m3?: number | null;
}) {
  const cfg = await loadConfig(undefined, args.vehicle_type);
  const axles = cfg.axlesByVehicle[vehicleLabelToKey(args.vehicle_type)] ?? null;
  return anttFloor({
    vehicle_type: args.vehicle_type,
    cargo_type: args.cargo_type,
    distance_km: args.distance_km,
    freight_mode: args.freight_mode,
    axles,
    rates: cfg.anttRates,
  });
}

// ============================================================
// Input compartilhado
// ============================================================
const pricingInputSchema = z.object({
  origemCidade: z.string().optional(),
  origemUf: z.string().length(2).optional(),
  destinoCidade: z.string().optional(),
  destinoUf: z.string().length(2).optional(),
  distanciaKm: z.number().positive(),
  vehicleType: z.string().min(1),
  pesoKg: z.number().positive(),
  volumeM3: z.number().nonnegative().optional(),
  cargoType: z.string().min(1),
  valorCargaDeclarado: z.number().nonnegative().optional(),
  temPedagio: z.boolean().optional(),
  rotaRisco: z.boolean().optional(),
  coletaNoturna: z.boolean().optional(),
  dataColeta: z.string().optional(),
  ajudantes: z.number().int().nonnegative().optional(),
  precisaCargaDescarga: z.boolean().optional(),
  horasEsperaExtra: z.number().nonnegative().optional(),
  precisaEquipamento: z.boolean().optional(),
  freightMode: z.enum(["LOTACAO", "FRACIONADO"]).optional(),
});

// ============================================================
// SIMULATE — pública (sem auth)
// ============================================================
export const simulatePricing = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pricingInputSchema.parse(d))
  .handler(async ({ data }) => {
    const cfg = await loadConfig(data.origemUf, data.vehicleType);
    const input: PricingInput = {
      ...data,
      fretesAbertosNaRota: cfg.fretesAbertosNaRota,
      motoristasAtivos: cfg.motoristasAtivos,
    };
    const result = calcularFrete(input, {
      settings: cfg.settings,
      vehicleCosts: cfg.vehicleCosts,
      cargoFactors: cfg.cargoFactors,
    });
    // Classificação automática caso não venha do cliente
    const classification = classifyFreight({
      pesoKg: data.pesoKg,
      volumeM3: data.volumeM3 ?? null,
      vehicleType: data.vehicleType,
    });
    const mode: FreightMode = data.freightMode ?? classification.mode;
    const axles = cfg.axlesByVehicle[vehicleLabelToKey(data.vehicleType)] ?? null;
    const antt = anttFloor({
      vehicle_type: data.vehicleType,
      cargo_type: data.cargoType,
      distance_km: data.distanciaKm,
      freight_mode: mode,
      axles,
      rates: cfg.anttRates,
    });
    return { ...result, antt, freight_mode: mode };
  });

// ============================================================
// ADMIN — leitura e atualização
// ============================================================
async function requireAdmin(context: any) {
  const { data } = await context.supabase.from("admins")
    .select("id,role,is_active").eq("user_id", context.userId).maybeSingle();
  if (!data || !data.is_active) throw new Error("Acesso negado");
  return data as { id: string; role: "ADMIN" | "SUPER_ADMIN"; is_active: boolean };
}

export const loadPricingConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const s = context.supabase;
    const [settings, vcosts, cfactors, antt, history] = await Promise.all([
      s.from("pricing_settings").select("*").eq("id", 1).maybeSingle(),
      s.from("pricing_vehicle_costs").select("*").order("ckm_cents_por_km"),
      s.from("pricing_cargo_factors").select("*").order("cargo_type"),
      s.from("antt_floor_rates").select("*").order("vehicle_axles").order("cargo_category").order("valid_from", { ascending: false }),
      s.from("pricing_settings_history").select("*").order("changed_at", { ascending: false }).limit(50),
    ]);
    return {
      settings: (settings.data?.settings as any) ?? DEFAULT_SETTINGS,
      vehicleCosts: vcosts.data ?? [],
      cargoFactors: cfactors.data ?? [],
      anttRates: antt.data ?? [],
      history: history.data ?? [],
    };
  });

export const updatePricingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ settings: z.record(z.string(), z.any()) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const s = context.supabase;
    const { data: prev } = await s.from("pricing_settings").select("settings").eq("id", 1).maybeSingle();
    await s.from("pricing_settings").upsert({ id: 1, settings: data.settings, updated_at: new Date().toISOString(), updated_by: context.userId });
    await s.from("pricing_settings_history").insert({
      changed_by: context.userId, entity: "settings", entity_key: null,
      before: prev?.settings ?? null, after: data.settings,
    });
    void admin;
    return { ok: true };
  });

export const updatePricingVehicleCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    vehicle_type: z.string(),
    ckm_cents_por_km: z.number().int().positive(),
    frete_minimo_cents: z.number().int().nonnegative(),
    capacidade_kg: z.number().int().positive(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const s = context.supabase;
    const { data: prev } = await s.from("pricing_vehicle_costs").select("*").eq("vehicle_type", data.vehicle_type).maybeSingle();
    await s.from("pricing_vehicle_costs").upsert({ ...data, updated_at: new Date().toISOString() });
    await s.from("pricing_settings_history").insert({
      changed_by: context.userId, entity: "vehicle_costs", entity_key: data.vehicle_type,
      before: prev ?? null, after: data,
    });
    return { ok: true };
  });

export const updatePricingCargoFactor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    cargo_type: z.string(),
    factor: z.number().positive(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const s = context.supabase;
    const { data: prev } = await s.from("pricing_cargo_factors").select("*").eq("cargo_type", data.cargo_type).maybeSingle();
    await s.from("pricing_cargo_factors").upsert({ ...data, updated_at: new Date().toISOString() });
    await s.from("pricing_settings_history").insert({
      changed_by: context.userId, entity: "cargo_factors", entity_key: data.cargo_type,
      before: prev ?? null, after: data,
    });
    return { ok: true };
  });
