/**
 * MOTOR DE PRECIFICAÇÃO DE FRETE — Freela Fretes
 *
 * Função pura de cálculo. Usada por:
 *   1. Simulador público (/simulador) e card na landing
 *   2. Passo "Datas e Valor" da publicação de frete
 *
 * TODAS as entradas monetárias e saídas em CENTAVOS (inteiro).
 * Nunca duplicar esta fórmula — se mudar, muda aqui.
 *
 * Configuração vive no banco (pricing_vehicle_costs, pricing_cargo_factors,
 * pricing_settings). Se algo faltar, aplica-se DEFAULT_SETTINGS e loga aviso.
 */

// ============================================================
// TIPOS
// ============================================================

export type VehicleTypeKey =
  | "vlc" | "toco" | "truck" | "bitruck" | "carreta" | "bitrem" | "rodotrem";

export type CargoTypeKey =
  | "graos" | "paletizada" | "granel_liquido" | "refrigerada"
  | "mudanca" | "veiculos" | "container"
  | "carga_perigosa" | "alto_valor" | "outros";

export type VehicleCost = {
  vehicle_type: VehicleTypeKey | string;
  ckm_cents_por_km: number;
  frete_minimo_cents: number;
  capacidade_kg: number;
};

export type PricingSettings = {
  peso_cubado_kg_por_m3: number;
  toll_cents_por_km: number;
  seguro_percent_valor_carga: number; // em %, ex 0.15
  seguro_min_cents: number;
  gris_percent_rota_risco: number;    // em %, ex 0.10
  adicional_ajudante_cents: number;
  adicional_carga_descarga_cents: number;
  adicional_espera_cents_hora: number;
  adicional_equipamento_cents: number;
  fator_urgencia_24h: number;
  fator_urgencia_48h: number;
  fator_noturno: number;
  fator_rota_risco: number;
  fd_min: number;
  fd_max: number;
  meses_safra: number[];
  safra_boost: number;
};

export const DEFAULT_SETTINGS: PricingSettings = {
  peso_cubado_kg_por_m3: 300,
  toll_cents_por_km: 12,
  seguro_percent_valor_carga: 0.15,
  seguro_min_cents: 3000,
  gris_percent_rota_risco: 0.10,
  adicional_ajudante_cents: 15000,
  adicional_carga_descarga_cents: 20000,
  adicional_espera_cents_hora: 8000,
  adicional_equipamento_cents: 12000,
  fator_urgencia_24h: 1.15,
  fator_urgencia_48h: 1.08,
  fator_noturno: 1.05,
  fator_rota_risco: 1.08,
  fd_min: 0.90,
  fd_max: 1.25,
  meses_safra: [2, 3, 4, 7, 8],
  safra_boost: 0.10,
};

export const DEFAULT_CARGO_FACTORS: Record<string, number> = {
  graos: 1.00,
  paletizada: 1.00,
  granel_liquido: 1.10,
  refrigerada: 1.25,
  mudanca: 1.15,
  veiculos: 1.20,
  container: 1.10,
  carga_perigosa: 1.40,
  alto_valor: 1.30,
  outros: 1.00,
};

export const DEFAULT_VEHICLE_COSTS: Record<string, VehicleCost> = {
  vlc:      { vehicle_type: "vlc",      ckm_cents_por_km: 220, frete_minimo_cents: 15000, capacidade_kg: 1500 },
  toco:     { vehicle_type: "toco",     ckm_cents_por_km: 320, frete_minimo_cents: 25000, capacidade_kg: 6000 },
  truck:    { vehicle_type: "truck",    ckm_cents_por_km: 400, frete_minimo_cents: 35000, capacidade_kg: 12000 },
  bitruck:  { vehicle_type: "bitruck",  ckm_cents_por_km: 460, frete_minimo_cents: 40000, capacidade_kg: 18000 },
  carreta:  { vehicle_type: "carreta",  ckm_cents_por_km: 550, frete_minimo_cents: 55000, capacidade_kg: 32000 },
  bitrem:   { vehicle_type: "bitrem",   ckm_cents_por_km: 650, frete_minimo_cents: 65000, capacidade_kg: 45000 },
  rodotrem: { vehicle_type: "rodotrem", ckm_cents_por_km: 720, frete_minimo_cents: 75000, capacidade_kg: 60000 },
};

// ============================================================
// MAPPING dos labels do app → chaves do motor
// ============================================================

const VEHICLE_LABEL_TO_KEY: Record<string, VehicleTypeKey> = {
  "VLC": "vlc",
  "Toco": "toco",
  "Truck": "truck",
  "Bitruck": "bitruck",
  "Carreta": "carreta",
  "Bitrem": "bitrem",
  "Rodotrem": "rodotrem",
};

const CARGO_LABEL_TO_KEY: Record<string, CargoTypeKey> = {
  "Grãos": "graos",
  "Carga Paletizada": "paletizada",
  "Granel Líquido": "granel_liquido",
  "Carga Refrigerada": "refrigerada",
  "Mudança": "mudanca",
  "Veículos": "veiculos",
  "Container": "container",
  "Carga Perigosa": "carga_perigosa",
  "Alto Valor": "alto_valor",
  "Outros": "outros",
};

export function vehicleLabelToKey(label: string): VehicleTypeKey {
  return VEHICLE_LABEL_TO_KEY[label] ?? (label.toLowerCase() as VehicleTypeKey);
}
export function cargoLabelToKey(label: string): CargoTypeKey {
  return CARGO_LABEL_TO_KEY[label] ?? "outros";
}

// ============================================================
// I/O
// ============================================================

export type PricingInput = {
  origemCidade?: string;
  origemUf?: string;
  destinoCidade?: string;
  destinoUf?: string;
  distanciaKm: number;
  vehicleType: string;      // label ou key
  pesoKg: number;
  volumeM3?: number;
  cargoType: string;        // label ou key
  valorCargaDeclarado?: number;   // em REAIS (input humano)
  temPedagio?: boolean;
  rotaRisco?: boolean;
  coletaNoturna?: boolean;
  dataColeta?: Date | string;
  ajudantes?: number;
  precisaCargaDescarga?: boolean;
  horasEsperaExtra?: number;
  precisaEquipamento?: boolean;
  // Contexto de mercado (opcional; simulador consulta banco)
  fretesAbertosNaRota?: number;
  motoristasAtivos?: number;
};

export type BreakdownLine = { label: string; valor: number; hint?: string };

export type PricingResult = {
  freteCents: number;
  faixaMinCents: number;
  faixaMaxCents: number;
  taxaPlataformaCents: number;
  totalEmbarcadorCents: number;
  breakdown: BreakdownLine[];
  fatores: { FP: number; FC: number; FR: number; FD: number };
  freteMinimoAplicado: boolean;
  warnings: string[];
};

// ============================================================
// HELPERS
// ============================================================

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function arredondar10(cents: number) { return Math.round(cents / 1000) * 1000; }

function hoursBetween(a: Date, b: Date) { return (b.getTime() - a.getTime()) / 36e5; }

// ============================================================
// CÁLCULO PRINCIPAL
// ============================================================

export function calcularFrete(
  input: PricingInput,
  config: {
    settings?: Partial<PricingSettings>;
    vehicleCosts?: Record<string, VehicleCost>;
    cargoFactors?: Record<string, number>;
  } = {},
): PricingResult {
  const warnings: string[] = [];
  const S: PricingSettings = { ...DEFAULT_SETTINGS, ...(config.settings ?? {}) };
  const VC = { ...DEFAULT_VEHICLE_COSTS, ...(config.vehicleCosts ?? {}) };
  const CF = { ...DEFAULT_CARGO_FACTORS, ...(config.cargoFactors ?? {}) };

  const vKey = vehicleLabelToKey(input.vehicleType);
  const cKey = cargoLabelToKey(input.cargoType);

  const veic = VC[vKey];
  if (!veic) {
    warnings.push(`Veículo "${input.vehicleType}" sem custo cadastrado — usando defaults.`);
  }
  const CKM = veic?.ckm_cents_por_km ?? DEFAULT_VEHICLE_COSTS.truck.ckm_cents_por_km;
  const capacidade = veic?.capacidade_kg ?? DEFAULT_VEHICLE_COSTS.truck.capacidade_kg;
  const freteMinimo = veic?.frete_minimo_cents ?? 0;

  // M1 — DISTÂNCIA
  // TODO: integrar API de rotas (Google/HERE) para calcular D e detecção de pedágio real.
  const D = Math.max(1, Math.round(input.distanciaKm));
  const pedagios = input.temPedagio ? D * S.toll_cents_por_km : 0;

  // M3 — CARGA (FP e FC)
  const pesoCubado = Math.round((input.volumeM3 ?? 0) * S.peso_cubado_kg_por_m3);
  const pesoTaxavel = Math.max(input.pesoKg, pesoCubado);
  const ocupacao = clamp(pesoTaxavel / Math.max(capacidade, 1), 0, 1);
  const FP = clamp(0.85 + 0.35 * ocupacao, 0.85, 1.20);

  const FC = CF[cKey] ?? 1.00;
  if (!(cKey in CF)) warnings.push(`Fator para carga "${input.cargoType}" ausente — usando 1.00.`);

  // M4 — RISCO / SEGURO
  const valorCargaCents = Math.round((input.valorCargaDeclarado ?? 0) * 100);
  const seguroBase = Math.round(valorCargaCents * (S.seguro_percent_valor_carga / 100));
  const seguroBaseComMin = Math.max(seguroBase, valorCargaCents > 0 ? S.seguro_min_cents : 0);
  const gris = input.rotaRisco ? Math.round(valorCargaCents * (S.gris_percent_rota_risco / 100)) : 0;
  const seguroTotal = seguroBaseComMin + gris;

  // fator de urgência
  let fatorUrg = 1.00;
  if (input.dataColeta) {
    const dc = typeof input.dataColeta === "string" ? new Date(input.dataColeta) : input.dataColeta;
    if (!isNaN(dc.getTime())) {
      const h = hoursBetween(new Date(), dc);
      if (h > 0 && h < 24) fatorUrg = S.fator_urgencia_24h;
      else if (h > 0 && h < 48) fatorUrg = S.fator_urgencia_48h;
    }
  }
  const FR = 1
    * (input.rotaRisco ? S.fator_rota_risco : 1)
    * (input.coletaNoturna ? S.fator_noturno : 1)
    * fatorUrg;

  // M5 — ADICIONAIS
  const adicionais =
    (input.ajudantes ?? 0) * S.adicional_ajudante_cents +
    (input.precisaCargaDescarga ? S.adicional_carga_descarga_cents : 0) +
    (input.horasEsperaExtra ?? 0) * S.adicional_espera_cents_hora +
    (input.precisaEquipamento ? S.adicional_equipamento_cents : 0);

  // M6 — MERCADO (FD)
  const pressao = (input.fretesAbertosNaRota ?? 0) / Math.max(input.motoristasAtivos ?? 1, 1);
  let FD = clamp(0.95 + 0.10 * pressao, S.fd_min, S.fd_max);
  if (cKey === "graos" && input.dataColeta) {
    const dc = typeof input.dataColeta === "string" ? new Date(input.dataColeta) : input.dataColeta;
    if (!isNaN(dc.getTime())) {
      const mes = dc.getMonth() + 1;
      if (S.meses_safra.includes(mes)) FD = Math.min(FD + S.safra_boost, S.fd_max);
    }
  }

  // ===== Composição =====
  const precoBase = Math.round(D * CKM * FP * FC);
  const custosFixos = pedagios + seguroTotal + adicionais;
  const subtotal = precoBase + custosFixos;

  const efeitoFR = Math.round(subtotal * (FR - 1));            // pode ser 0
  const subtotalComFR = subtotal + efeitoFR;
  const efeitoFD = Math.round(subtotalComFR * (FD - 1));       // pode ser negativo
  const brutoFinal = subtotalComFR + efeitoFD;

  let freteCents = arredondar10(brutoFinal);
  let freteMinimoAplicado = false;
  if (freteCents < freteMinimo) {
    freteCents = freteMinimo;
    freteMinimoAplicado = true;
  }

  const faixaMinCents = arredondar10(freteCents * 0.92);
  const faixaMaxCents = arredondar10(freteCents * 1.12);
  const taxaPlataformaCents = Math.round(freteCents * 0.10);
  const totalEmbarcadorCents = freteCents + taxaPlataformaCents;

  const breakdown: BreakdownLine[] = [
    { label: "Distância e veículo", valor: precoBase, hint: `${D} km × R$ ${(CKM / 100).toFixed(2)}/km × FP ${FP.toFixed(2)} × FC ${FC.toFixed(2)}` },
    { label: "Pedágios", valor: pedagios, hint: input.temPedagio ? `${D} km × R$ ${(S.toll_cents_por_km / 100).toFixed(2)}` : "Não incluso" },
    { label: "Seguro da carga", valor: seguroTotal, hint: valorCargaCents > 0 ? `~${S.seguro_percent_valor_carga}% do valor declarado${input.rotaRisco ? " + GRIS de rota de risco" : ""}` : "Sem valor declarado" },
    { label: "Serviços adicionais", valor: adicionais, hint: adicionais > 0 ? "Ajudantes, carga/descarga, espera, equipamentos" : "Nenhum" },
    { label: "Ajuste de risco/urgência", valor: efeitoFR, hint: `FR ${FR.toFixed(2)}` },
    { label: "Preço dinâmico (oferta × demanda)", valor: efeitoFD, hint: `FD ${FD.toFixed(2)} — mercado ${pressao > 1 ? "aquecido" : "estável"}` },
  ];
  if (freteMinimoAplicado) {
    breakdown.push({ label: "Frete mínimo aplicado", valor: freteCents - brutoFinal, hint: `Mínimo do veículo: R$ ${(freteMinimo / 100).toFixed(2)}` });
  }

  return {
    freteCents,
    faixaMinCents,
    faixaMaxCents,
    taxaPlataformaCents,
    totalEmbarcadorCents,
    breakdown,
    fatores: { FP, FC, FR, FD },
    freteMinimoAplicado,
    warnings,
  };
}

// ============================================================
// TESTES DE SANIDADE (exemplos comentados)
// ============================================================
// 1. Carreta de grãos Sorriso→Santos, 1.980 km, 32.000 kg, com pedágio:
//    calcularFrete({ distanciaKm: 1980, vehicleType: "carreta", pesoKg: 32000,
//      cargoType: "graos", temPedagio: true, dataColeta: "2026-03-15" })
//    → freteCents ≈ 1_200_000 a 1_400_000 (R$ 12.000 – R$ 14.000)
//
// 2. VLC urbana 40 km, 800 kg, sem pedágio:
//    calcularFrete({ distanciaKm: 40, vehicleType: "vlc", pesoKg: 800,
//      cargoType: "paletizada" })
//    → freteCents ≈ 15_000 – 25_000 (frete mínimo do VLC = R$ 150)
