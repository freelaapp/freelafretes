// ============================================================
// Classificador Lotação × Fracionada (função pura)
// Etapas 1-2 do fluxo de publicação
// ============================================================

export type FreightMode = "LOTACAO" | "FRACIONADO";

export type ClassifyInput = {
  pesoKg: number;
  volumeM3?: number | null;
  vehicleType?: string | null;           // rótulo (ex.: "Truck")
  capacidadeKgVeiculo?: number | null;   // se conhecido do catálogo
  capacidadeM3Veiculo?: number | null;   // idem
};

export type ClassifyResult = {
  mode: FreightMode;
  reason: string;
  occupancyPct: number | null;           // ocupação (0-1+) — max entre peso e volume
  occupancyPeso: number | null;
  occupancyVolume: number | null;
  warning: string | null;                // aviso ao usuário (excede capacidade etc.)
};

// Capacidades típicas por veículo (usadas quando a config vinda do banco não trouxer)
const CAP_KG_FALLBACK: Record<string, number> = {
  vlc: 1500, toco: 6000, truck: 12000, bitruck: 16000,
  carreta: 27000, bitrem: 37000, rodotrem: 45000,
};
const CAP_M3_FALLBACK: Record<string, number> = {
  vlc: 12, toco: 40, truck: 55, bitruck: 65,
  carreta: 90, bitrem: 120, rodotrem: 140,
};

function keyOf(v?: string | null): string | null {
  if (!v) return null;
  return v.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Classifica um frete como LOTAÇÃO ou FRACIONADO.
 *
 * Regra:
 *  - Sem veículo escolhido → usa apenas peso (≥ 3000 kg = LOTAÇÃO).
 *  - Com veículo → calcula ocupação (max entre peso e volume vs capacidade).
 *    ≥ 70% → LOTAÇÃO. Caso contrário FRACIONADO.
 */
export function classifyFreight(input: ClassifyInput): ClassifyResult {
  const k = keyOf(input.vehicleType);
  const capKg = input.capacidadeKgVeiculo ?? (k ? CAP_KG_FALLBACK[k] : null) ?? null;
  const capM3 = input.capacidadeM3Veiculo ?? (k ? CAP_M3_FALLBACK[k] : null) ?? null;

  const occPeso = capKg && capKg > 0 ? input.pesoKg / capKg : null;
  const occVol = capM3 && capM3 > 0 && input.volumeM3 && input.volumeM3 > 0
    ? input.volumeM3 / capM3 : null;

  const occ = [occPeso, occVol].filter((v): v is number => typeof v === "number");
  const occMax = occ.length ? Math.max(...occ) : null;

  let warning: string | null = null;
  if (capKg && input.pesoKg > capKg) {
    warning = `Peso (${input.pesoKg.toLocaleString("pt-BR")} kg) excede a capacidade do ${input.vehicleType} (${capKg.toLocaleString("pt-BR")} kg). Considere um veículo maior.`;
  } else if (capM3 && input.volumeM3 && input.volumeM3 > capM3) {
    warning = `Volume (${input.volumeM3} m³) excede a capacidade do ${input.vehicleType} (${capM3} m³). Considere um veículo maior.`;
  }

  // Sem veículo: decide só pelo peso
  if (occMax == null) {
    const mode: FreightMode = input.pesoKg >= 3000 ? "LOTACAO" : "FRACIONADO";
    return {
      mode,
      reason: mode === "LOTACAO"
        ? "Peso alto (≥ 3 t) — carga de lotação."
        : "Carga leve (< 3 t) — fracionada.",
      occupancyPct: null,
      occupancyPeso: null,
      occupancyVolume: null,
      warning,
    };
  }

  const mode: FreightMode = occMax >= 0.7 ? "LOTACAO" : "FRACIONADO";
  const pct = Math.round(occMax * 100);
  const reason = mode === "LOTACAO"
    ? `Ocupação estimada de ${pct}% — carga de lotação.`
    : `Ocupação estimada de ${pct}% — cabe compartilhado (fracionado).`;

  return {
    mode,
    reason,
    occupancyPct: occMax,
    occupancyPeso: occPeso,
    occupancyVolume: occVol,
    warning,
  };
}

export function freightModeLabel(m: FreightMode): string {
  return m === "LOTACAO" ? "Lotação" : "Fracionado";
}
