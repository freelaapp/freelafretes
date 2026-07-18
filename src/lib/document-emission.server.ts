import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// EMITEAÍ (MOCK) — Simulação de emissão de documentação fiscal
// ============================================================

export type FreightDocType = "CTE" | "MDFE" | "CIOT" | "AVERBACAO";
export type FreightDocStatus = "PENDING" | "ISSUED" | "CANCELLED";

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
  created_at: string;
  updated_at: string;
}

export interface JobForEmission {
  id: string;
  freight_mode?: "LOTACAO" | "FRACIONADO" | null;
  agreed_amount_in_cents?: number | null;
  freights?: {
    title?: string | null;
    origin_city?: string | null;
    origin_uf?: string | null;
    destination_city?: string | null;
    destination_uf?: string | null;
    weight_kg?: number | null;
    cargo_type?: string | null;
    freight_mode?: "LOTACAO" | "FRACIONADO" | null;
  } | null;
}

export interface DocumentEmissionProvider {
  emitTripDocuments(job: JobForEmission): Promise<FreightDocumentRow[]>;
  cancelDocuments(jobId: string): Promise<void>;
  getDocuments(jobId: string): Promise<FreightDocumentRow[]>;
  markMdfeClosed(jobId: string): Promise<void>;
}

// ---------- helpers ----------

function randDigits(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10).toString();
  return s;
}

function randAlnum(n: number): string {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < n; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

// Gera uma "chave de acesso" de 44 dígitos (formato CT-e / MDF-e).
// Estrutura simulada: UF(2) + AAMM(4) + CNPJ(14) + modelo(2) + série(3) + número(9) + tpEmis(1) + código(8) + DV(1)
function makeAccessKey44(model: "57" | "58"): string {
  const now = new Date();
  const uf = "35"; // SP fictício
  const aamm =
    now.getFullYear().toString().slice(-2) + String(now.getMonth() + 1).padStart(2, "0");
  const cnpj = randDigits(14);
  const serie = randDigits(3);
  const numero = randDigits(9);
  const tpEmis = "1";
  const codigo = randDigits(8);
  const base = uf + aamm + cnpj + model + serie + numero + tpEmis + codigo;
  // DV mod11 simplificado
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

function makeDocNumber(prefix: string): string {
  return `${prefix}-${randDigits(9)}`;
}

// ---------- Mock provider ----------

async function getAdmin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

class MockEmiteaiProvider implements DocumentEmissionProvider {
  async emitTripDocuments(job: JobForEmission): Promise<FreightDocumentRow[]> {
    const admin = await getAdmin();

    // Idempotência: se já existem docs emitidos para este job, retorna-os.
    const { data: existing } = await admin
      .from("freight_documents")
      .select("*")
      .eq("job_id", job.id);
    if (existing && existing.length > 0) {
      return existing as FreightDocumentRow[];
    }

    const mode = job.freight_mode ?? job.freights?.freight_mode ?? "LOTACAO";
    const now = new Date().toISOString();
    const f = job.freights ?? {};
    const cargoSummary = {
      title: f.title ?? null,
      origem: f.origin_city && f.origin_uf ? `${f.origin_city}/${f.origin_uf}` : null,
      destino:
        f.destination_city && f.destination_uf
          ? `${f.destination_city}/${f.destination_uf}`
          : null,
      peso_kg: f.weight_kg ?? null,
      tipo_carga: f.cargo_type ?? null,
      valor_frete_centavos: job.agreed_amount_in_cents ?? null,
      modo: mode,
      emitido_em: now,
    };

    const cteKey = makeAccessKey44("57");
    const mdfeKey = makeAccessKey44("58");

    const rows: Array<Omit<FreightDocumentRow, "id" | "created_at" | "updated_at">> = [
      {
        job_id: job.id,
        doc_type: "CTE",
        doc_number: makeDocNumber("CTE"),
        access_key: cteKey,
        status: "ISSUED",
        issued_at: now,
        payload: { resumo: cargoSummary, chave: cteKey },
        provider: "EMITEAI_MOCK",
      },
      {
        job_id: job.id,
        doc_type: "MDFE",
        doc_number: makeDocNumber("MDFE"),
        access_key: mdfeKey,
        status: "ISSUED",
        issued_at: now,
        payload: { resumo: cargoSummary, chave: mdfeKey, encerrado: false },
        provider: "EMITEAI_MOCK",
      },
      {
        job_id: job.id,
        doc_type: "AVERBACAO",
        doc_number: null,
        access_key: null,
        status: "ISSUED",
        issued_at: now,
        payload: {
          resumo: cargoSummary,
          protocolo: `AVB${randAlnum(10)}`,
          seguradora: "Emiteaí Seguros (mock)",
        },
        provider: "EMITEAI_MOCK",
      },
    ];

    if (mode === "LOTACAO") {
      rows.push({
        job_id: job.id,
        doc_type: "CIOT",
        doc_number: randDigits(12),
        access_key: null,
        status: "ISSUED",
        issued_at: now,
        payload: { resumo: cargoSummary, contratante: "mock" },
        provider: "EMITEAI_MOCK",
      });
    }

    const { data: inserted, error } = await admin
      .from("freight_documents")
      .insert(rows)
      .select("*");
    if (error) throw error;
    return (inserted ?? []) as FreightDocumentRow[];
  }

  async cancelDocuments(jobId: string): Promise<void> {
    const admin = await getAdmin();
    await admin
      .from("freight_documents")
      .update({ status: "CANCELLED" })
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

  async markMdfeClosed(jobId: string): Promise<void> {
    const admin = await getAdmin();
    const { data } = await admin
      .from("freight_documents")
      .select("id,payload")
      .eq("job_id", jobId)
      .eq("doc_type", "MDFE")
      .eq("status", "ISSUED")
      .maybeSingle();
    if (!data) return;
    const payload = { ...(data.payload as Record<string, unknown>), encerrado: true, encerrado_em: new Date().toISOString() };
    await admin.from("freight_documents").update({ payload }).eq("id", data.id);
  }
}

export const documentProvider: DocumentEmissionProvider = new MockEmiteaiProvider();
