// ============================================================
// Piso mínimo ANTT — Lei 13.703/2018 (função pura)
// ============================================================

import { vehicleLabelToKey } from "./pricing";
import type { FreightMode } from "./freight-classifier";

export type AnttRate = {
  vehicle_axles: number;
  cargo_category: string;
  rate_per_km_cents: number;
  load_unload_cents: number;
  valid_from?: string | null;
  valid_to?: string | null;
};

export type AnttFloorInput = {
  vehicle_type: string;                 // rótulo ou key
  cargo_type: string;                   // rótulo ou key
  distance_km: number;
  freight_mode: FreightMode;
  axles?: number | null;                // eixos conhecidos (opcional)
  rates: AnttRate[];                    // catálogo carregado
};

export type AnttFloorResult = {
  is_applicable: boolean;               // false quando FRACIONADO
  floor_cents: number;                  // 0 quando não aplicável / não encontrado
  rate_used: AnttRate | null;
  category: string;
  axles: number | null;
  reason: string;
};

// Eixos por tipo de veículo (fallback quando o catálogo não vier populado)
const AXLES_BY_VEHICLE_KEY: Record<string, number> = {
  vlc: 2, toco: 2, truck: 3, bitruck: 4,
  carreta: 5, bitrem: 7, rodotrem: 9,
};

// Mapeia nosso rótulo/key de carga → categoria ANTT
const CARGO_TO_ANTT: Record<string, string> = {
  // rótulos
  "Grãos": "granel_solido",
  "Fertilizante": "granel_solido",
  "Combustível": "granel_liquido",
  "Refrigerada": "frigorificada",
  "Container": "conteineirizada",
  "Carga Perigosa": "perigosa_geral",
  "Paletizada": "geral",
  "Alto Valor": "geral",
  "Outros": "geral",
  // keys
  graos: "granel_solido",
  fertilizante: "granel_solido",
  combustivel: "granel_liquido",
  refrigerada: "frigorificada",
  container: "conteineirizada",
  carga_perigosa: "perigosa_geral",
  paletizada: "geral",
  alto_valor: "geral",
  outros: "geral",
};

export function cargoToAnttCategory(cargo: string): string {
  return CARGO_TO_ANTT[cargo] ?? CARGO_TO_ANTT[cargo?.toLowerCase?.() ?? ""] ?? "geral";
}

function pickRate(rates: AnttRate[], axles: number, category: string): AnttRate | null {
  const today = new Date().toISOString().slice(0, 10);
  const active = rates.filter((r) =>
    r.vehicle_axles === axles &&
    (!r.valid_from || r.valid_from <= today) &&
    (!r.valid_to || r.valid_to >= today),
  );
  // Prefer exact category, fallback to 'geral'
  const exact = active.find((r) => r.cargo_category === category);
  if (exact) return exact;
  return active.find((r) => r.cargo_category === "geral") ?? null;
}

/**
 * Calcula o piso mínimo ANTT para o frete.
 * Fracionado é isento (is_applicable = false).
 */
export function anttFloor(input: AnttFloorInput): AnttFloorResult {
  const category = cargoToAnttCategory(input.cargo_type);
  const key = vehicleLabelToKey(input.vehicle_type);
  const axles = input.axles ?? AXLES_BY_VEHICLE_KEY[key] ?? null;

  if (input.freight_mode === "FRACIONADO") {
    return {
      is_applicable: false, floor_cents: 0, rate_used: null,
      category, axles,
      reason: "Frete fracionado — isento de piso mínimo ANTT.",
    };
  }
  if (!axles) {
    return {
      is_applicable: true, floor_cents: 0, rate_used: null,
      category, axles: null,
      reason: "Piso ANTT indisponível: número de eixos do veículo não configurado.",
    };
  }
  const rate = pickRate(input.rates, axles, category);
  if (!rate) {
    return {
      is_applicable: true, floor_cents: 0, rate_used: null,
      category, axles,
      reason: `Piso ANTT indisponível: sem tarifa cadastrada para ${axles} eixos / ${category}.`,
    };
  }
  const floor_cents = Math.max(0, Math.round(input.distance_km * rate.rate_per_km_cents + rate.load_unload_cents));
  return {
    is_applicable: true,
    floor_cents,
    rate_used: rate,
    category,
    axles,
    reason: `Piso ANTT (${axles} eixos · ${category}): R$ ${(rate.rate_per_km_cents / 100).toFixed(2)}/km × ${input.distance_km} km + carga/descarga.`,
  };
}
