import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// EMITEAÍ — Motor fiscal simulado.
//
// Toda a lógica passa pela interface FiscalProvider abaixo. Quando a API
// real da Emiteaí entrar, basta trocar a implementação (MockEmiteaiProvider)
// sem alterar os call sites (api.functions.ts, admin.functions.ts, etc).
// ============================================================

export type FreightDocType = "CTE" | "MDFE" | "CIOT" | "AVERBACAO";
export type FreightDocStatus = "PENDING" | "ISSUED" | "CANCELLED";
export type FreightDocEvent =
  | "ISSUED"
  | "COMPLEMENTAR"
  | "DELIVERED"
  | "CLOSED"
  | "CANCELLED";

export interface FreightDocumentRow {
  id: string;
  job_id: string;
  doc_type: FreightDocType;
  doc_number: string | null;
  access_key: string | null;
  status: FreightDocStatus;
  issued_at: string | null;
  payload: Record<string, unknown>;
  provider: string;
  event_type: FreightDocEvent | null;
  parent_doc_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NfeSummary {
  chave: string;
  emitente: { cnpj: string; razao_social: string };
  destinatario: { cnpj: string; razao_social: string };
  valor_nota_centavos: number;
  peso_kg: number;
  volume_m3: number;
  produtos: Array<{ descricao: string; ncm: string; quantidade: number }>;
  emitido_em: string;
}

export interface JobForEmission {
  id: string;
  freight_mode?: "LOTACAO" | "FRACIONADO" | null;
  agreed_amount_in_cents?: number | null;
  driver_payout_cents?: number | null;
  freights?: {
    title?: string | null;
    origin_city?: string | null;
    origin_uf?: string | null;
    destination_city?: string | null;
    destination_uf?: string | null;
    weight_kg?: number | null;
    cargo_type?: string | null;
    freight_mode?: "LOTACAO" | "FRACIONADO" | null;
    driver_payout_cents?: number | null;
    nfe_summary?: unknown;
  } | null;
}

export interface FiscalProvider {
  // Consulta uma NF-e (mock: gera resumo determinístico a partir da chave)
  fetchNFe(chave: string): Promise<NfeSummary>;
  // Emissões
  emitCTe(job: JobForEmission): Promise<FreightDocumentRow>;
  averbarSeguro(job: JobForEmission, cte: FreightDocumentRow): Promise<FreightDocumentRow>;
  emitCIOT(job: JobForEmission): Promise<FreightDocumentRow>; // valida piso ANTT (throws)
  emitMDFe(job: JobForEmission): Promise<FreightDocumentRow>;
  emitCTeComplementar(
    job: JobForEmission,
    valorCentavos: number,
    motivo: string,
  ): Promise<FreightDocumentRow>;
  // Eventos
  registrarEntrega(jobId: string): Promise<void>;
  encerrarMDFe(jobId: string): Promise<void>;
  cancelAll(jobId: string): Promise<void>;
  // Helpers
  getDocuments(jobId: string): Promise<FreightDocumentRow[]>;
  // Orquestração usada quando o pagamento entra em HELD
  emitTripDocuments(job: JobForEmission): Promise<FreightDocumentRow[]>;
  // Aliases de retrocompatibilidade
  cancelDocuments(jobId: string): Promise<void>;
  markMdfeClosed(jobId: string): Promise<void>;
}

// ---------- helpers ----------

async function getAdmin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

// Hash 32-bit determinístico a partir de string (FNV-1a).
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

// Mulberry32 PRNG semeado — números determinísticos por (jobId, tag).
function seeded(jobId: string, tag: string) {
  let state = fnv1a(`${jobId}::${tag}`);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function digits(rng: () => number, n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(rng() * 10).toString();
  return s;
}
function alnum(rng: () => number, n: number): string {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < n; i++) s += A[Math.floor(rng() * A.length)];
  return s;
}

// Chave de acesso de 44 dígitos (formato CT-e/MDF-e/NF-e).
function makeAccessKey44(rng: () => number, model: "55" | "57" | "58"): string {
  const now = new Date();
  const uf = "35";
  const aamm =
    now.getFullYear().toString().slice(-2) + String(now.getMonth() + 1).padStart(2, "0");
  const cnpj = digits(rng, 14);
  const serie = digits(rng, 3);
  const numero = digits(rng, 9);
  const tpEmis = "1";
  const codigo = digits(rng, 8);
  const base = uf + aamm + cnpj + model + serie + numero + tpEmis + codigo;
  let sum = 0;
  let weight = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    sum += parseInt(base[i], 10) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const mod = sum % 11;
  const dv = mod < 2 ? "0" : (11 - mod).toString();
  return base + dv;
}

function cargoResumo(job: JobForEmission) {
  const f = job.freights ?? {};
  return {
    title: f.title ?? null,
    origem: f.origin_city && f.origin_uf ? `${f.origin_city}/${f.origin_uf}` : null,
    destino:
      f.destination_city && f.destination_uf
        ? `${f.destination_city}/${f.destination_uf}`
        : null,
    peso_kg: f.weight_kg ?? null,
    tipo_carga: f.cargo_type ?? null,
    valor_frete_centavos: job.agreed_amount_in_cents ?? null,
    valor_repasse_centavos: job.driver_payout_cents ?? f.driver_payout_cents ?? null,
    modo: job.freight_mode ?? f.freight_mode ?? null,
  };
}

async function insertDoc(
  admin: SupabaseClient,
  row: Omit<FreightDocumentRow, "id" | "created_at" | "updated_at">,
): Promise<FreightDocumentRow> {
  const { data, error } = await admin.from("freight_documents").insert(row).select("*").single();
  if (error) throw error;
  return data as FreightDocumentRow;
}

async function findLatest(
  admin: SupabaseClient,
  jobId: string,
  docType: FreightDocType,
  status: FreightDocStatus = "ISSUED",
): Promise<FreightDocumentRow | null> {
  const { data } = await admin
    .from("freight_documents")
    .select("*")
    .eq("job_id", jobId)
    .eq("doc_type", docType)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as FreightDocumentRow) ?? null;
}

// ============================================================
// MOCK EMITEAÍ
// ============================================================

class MockEmiteaiProvider implements FiscalProvider {
  // ---- Consulta NF-e ----
  async fetchNFe(chave: string): Promise<NfeSummary> {
    const rng = seeded(chave, "nfe");
    const cnpjE = digits(rng, 14);
    const cnpjD = digits(rng, 14);
    const razoes = ["Indústria Freela Ltda", "Distribuidora Rota Segura", "AgroBrasil Comercial", "Metalúrgica Guarulhos"];
    return {
      chave,
      emitente: { cnpj: cnpjE, razao_social: razoes[Math.floor(rng() * razoes.length)] },
      destinatario: { cnpj: cnpjD, razao_social: razoes[Math.floor(rng() * razoes.length)] },
      valor_nota_centavos: Math.floor(rng() * 900_000_00) + 10_000_00,
      peso_kg: Math.floor(rng() * 25_000) + 500,
      volume_m3: Math.round((rng() * 60 + 2) * 10) / 10,
      produtos: [
        { descricao: "Mercadoria geral", ncm: digits(rng, 8), quantidade: Math.floor(rng() * 200) + 1 },
      ],
      emitido_em: new Date().toISOString(),
    };
  }

  // ---- CT-e ----
  async emitCTe(job: JobForEmission): Promise<FreightDocumentRow> {
    const admin = await getAdmin();
    const existing = await findLatest(admin, job.id, "CTE");
    if (existing) return existing;
    const rng = seeded(job.id, "cte");
    const chave = makeAccessKey44(rng, "57");
    const valorFrete = job.agreed_amount_in_cents ?? 0;
    const icmsCentavos = Math.round(valorFrete * 0.12);
    return insertDoc(admin, {
      job_id: job.id,
      doc_type: "CTE",
      doc_number: `CTE-${digits(rng, 9)}`,
      access_key: chave,
      status: "ISSUED",
      issued_at: new Date().toISOString(),
      event_type: "ISSUED",
      parent_doc_id: null,
      provider: "EMITEAI_MOCK",
      payload: {
        resumo: cargoResumo(job),
        chave,
        emitente: "Freela Fretes Transportes ETC",
        tomador: "Embarcador",
        icms_centavos: icmsCentavos,
        aliquota_icms: 0.12,
      },
    });
  }

  // ---- Averbação ----
  async averbarSeguro(job: JobForEmission, cte: FreightDocumentRow): Promise<FreightDocumentRow> {
    const admin = await getAdmin();
    const existing = await findLatest(admin, job.id, "AVERBACAO");
    if (existing) return existing;
    const rng = seeded(job.id, "averbacao");
    return insertDoc(admin, {
      job_id: job.id,
      doc_type: "AVERBACAO",
      doc_number: `AVB${alnum(rng, 10)}`,
      access_key: null,
      status: "ISSUED",
      issued_at: new Date().toISOString(),
      event_type: "ISSUED",
      parent_doc_id: cte.id,
      provider: "EMITEAI_MOCK",
      payload: {
        resumo: cargoResumo(job),
        seguradora: "Emiteaí Seguros (mock)",
        cobertura: "RCTR-C",
        cte_chave: cte.access_key,
        protocolo: `AVB${alnum(rng, 10)}`,
      },
    });
  }

  // ---- CIOT (com trava real de piso ANTT) ----
  async emitCIOT(job: JobForEmission): Promise<FreightDocumentRow> {
    const admin = await getAdmin();
    const mode = job.freight_mode ?? job.freights?.freight_mode ?? "LOTACAO";
    if (mode !== "LOTACAO") {
      throw new Error("CIOT é obrigatório apenas para fretes de lotação");
    }
    const existing = await findLatest(admin, job.id, "CIOT");
    if (existing) return existing;

    // Trava simulada: repasse ao motorista deve ser >= piso ANTT verificado no publish.
    // Como o piso já foi checado em publishFreight/simulatePricing, aqui garantimos o mínimo real:
    const repasse = job.driver_payout_cents ?? job.freights?.driver_payout_cents ?? 0;
    if (!repasse || repasse <= 0) {
      throw new Error(
        "CIOT recusado pela Emiteaí: repasse ao motorista abaixo do piso mínimo ANTT (MP 1.343/2026)",
      );
    }

    const rng = seeded(job.id, "ciot");
    return insertDoc(admin, {
      job_id: job.id,
      doc_type: "CIOT",
      doc_number: digits(rng, 12),
      access_key: null,
      status: "ISSUED",
      issued_at: new Date().toISOString(),
      event_type: "ISSUED",
      parent_doc_id: null,
      provider: "EMITEAI_MOCK",
      payload: {
        resumo: cargoResumo(job),
        contratante: "Freela Fretes Transportes ETC",
        repasse_centavos: repasse,
      },
    });
  }

  // ---- MDF-e ----
  async emitMDFe(job: JobForEmission): Promise<FreightDocumentRow> {
    const admin = await getAdmin();
    const existing = await findLatest(admin, job.id, "MDFE");
    if (existing) return existing;
    const cte = await findLatest(admin, job.id, "CTE");
    const rng = seeded(job.id, "mdfe");
    const chave = makeAccessKey44(rng, "58");
    // Busca veículo e condutor da viagem
    const { data: jj } = await admin
      .from("jobs")
      .select("provider_id, providers(full_name, cnh_number), candidacies(vehicle_id, vehicles(plate, vehicle_type))")
      .eq("id", job.id)
      .maybeSingle();
    const veic = (jj as any)?.candidacies?.[0]?.vehicles ?? null;
    const cond = (jj as any)?.providers ?? null;
    return insertDoc(admin, {
      job_id: job.id,
      doc_type: "MDFE",
      doc_number: `MDFE-${digits(rng, 9)}`,
      access_key: chave,
      status: "ISSUED",
      issued_at: new Date().toISOString(),
      event_type: "ISSUED",
      parent_doc_id: cte?.id ?? null,
      provider: "EMITEAI_MOCK",
      payload: {
        resumo: cargoResumo(job),
        chave,
        encerrado: false,
        cte_chave: cte?.access_key ?? null,
        veiculo: veic ? { placa: veic.plate, tipo: veic.vehicle_type } : null,
        condutor: cond ? { nome: cond.full_name, cnh: cond.cnh_number } : null,
      },
    });
  }

  // ---- CT-e complementar ----
  async emitCTeComplementar(
    job: JobForEmission,
    valorCentavos: number,
    motivo: string,
  ): Promise<FreightDocumentRow> {
    if (valorCentavos <= 0) throw new Error("Valor complementar deve ser positivo");
    const admin = await getAdmin();
    const parent = await findLatest(admin, job.id, "CTE");
    if (!parent) throw new Error("CT-e original não encontrado — não é possível complementar");
    const rng = seeded(`${job.id}:${Date.now()}`, "cte-comp");
    const chave = makeAccessKey44(rng, "57");
    const icms = Math.round(valorCentavos * 0.12);
    return insertDoc(admin, {
      job_id: job.id,
      doc_type: "CTE",
      doc_number: `CTE-${digits(rng, 9)}`,
      access_key: chave,
      status: "ISSUED",
      issued_at: new Date().toISOString(),
      event_type: "COMPLEMENTAR",
      parent_doc_id: parent.id,
      provider: "EMITEAI_MOCK",
      payload: {
        resumo: cargoResumo(job),
        chave,
        motivo,
        valor_complementar_centavos: valorCentavos,
        icms_centavos: icms,
        cte_original: parent.access_key,
      },
    });
  }

  // ---- Eventos ----
  async registrarEntrega(jobId: string): Promise<void> {
    const admin = await getAdmin();
    const cte = await findLatest(admin, jobId, "CTE");
    if (!cte) return;
    const payload = {
      ...(cte.payload as Record<string, unknown>),
      entrega: { registrada_em: new Date().toISOString(), evento: "DELIVERED" },
    };
    await admin
      .from("freight_documents")
      .update({ payload, event_type: "DELIVERED" })
      .eq("id", cte.id);
  }

  async encerrarMDFe(jobId: string): Promise<void> {
    const admin = await getAdmin();
    const mdfe = await findLatest(admin, jobId, "MDFE");
    if (!mdfe) return;
    const payload = {
      ...(mdfe.payload as Record<string, unknown>),
      encerrado: true,
      encerrado_em: new Date().toISOString(),
    };
    await admin
      .from("freight_documents")
      .update({ payload, event_type: "CLOSED" })
      .eq("id", mdfe.id);
  }

  async cancelAll(jobId: string): Promise<void> {
    const admin = await getAdmin();
    await admin
      .from("freight_documents")
      .update({ status: "CANCELLED", event_type: "CANCELLED" })
      .eq("job_id", jobId)
      .neq("status", "CANCELLED");
  }

  async getDocuments(jobId: string): Promise<FreightDocumentRow[]> {
    const admin = await getAdmin();
    const { data } = await admin
      .from("freight_documents")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });
    return (data ?? []) as FreightDocumentRow[];
  }

  // Orquestração no pagamento (HELD): CT-e + averbação + (CIOT se lotação).
  // MDF-e sai no check-in (emitMDFe chamado em confirmPickup).
  async emitTripDocuments(job: JobForEmission): Promise<FreightDocumentRow[]> {
    const admin = await getAdmin();
    const existing = await admin
      .from("freight_documents")
      .select("id")
      .eq("job_id", job.id)
      .eq("status", "ISSUED");
    if ((existing.data ?? []).length > 0) {
      return this.getDocuments(job.id);
    }
    const rows: FreightDocumentRow[] = [];
    const cte = await this.emitCTe(job);
    rows.push(cte);
    rows.push(await this.averbarSeguro(job, cte));
    const mode = job.freight_mode ?? job.freights?.freight_mode ?? "LOTACAO";
    if (mode === "LOTACAO") rows.push(await this.emitCIOT(job));
    return rows;
  }

  // ---- Aliases ----
  async cancelDocuments(jobId: string): Promise<void> {
    return this.cancelAll(jobId);
  }
  async markMdfeClosed(jobId: string): Promise<void> {
    return this.encerrarMDFe(jobId);
  }
}

export const documentProvider: FiscalProvider = new MockEmiteaiProvider();

// Retrocompatibilidade com nome antigo.
export type DocumentEmissionProvider = FiscalProvider;
