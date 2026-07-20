// Cálculo puro de retenções do TAC (Transportador Autônomo de Cargas)
// - INSS: 2,2% sobre o valor do frete (art. 30, §4º da Lei 8.212/91)
// - SEST/SENAT: 0,5% (2,5% x 20% da base, aplicado sobre 20% do frete)
export const INSS_RATE = 0.022;
export const SEST_SENAT_RATE = 0.005;
// ICMS destacado padrão do CT-e (crédito recuperável para o embarcador)
export const ICMS_DEFAULT_RATE = 0.12;

export type PayoutBreakdown = {
  grossCents: number;
  inssCents: number;
  sestSenatCents: number;
  netCents: number;
};

export function computePayout(grossCents: number): PayoutBreakdown {
  const gross = Math.max(0, Math.round(grossCents));
  const inss = Math.round(gross * INSS_RATE);
  const sest = Math.round(gross * SEST_SENAT_RATE);
  const net = Math.max(0, gross - inss - sest);
  return { grossCents: gross, inssCents: inss, sestSenatCents: sest, netCents: net };
}

export function computeIcms(amountCents: number, rate = ICMS_DEFAULT_RATE): number {
  return Math.round(Math.max(0, amountCents) * rate);
}
