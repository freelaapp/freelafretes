import { createServerFn } from "@tanstack/react-start";
import { getHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { createHash } from "crypto";
import { CONTRACT_SHIPPER_VERSION, CONTRACT_DRIVER_VERSION } from "./contracts";

const CONTRACT_TYPES = ["EMBARCADOR_TRANSPORTE", "TAC_SUBCONTRATACAO"] as const;
type ContractType = (typeof CONTRACT_TYPES)[number];

function currentVersion(t: ContractType) {
  return t === "EMBARCADOR_TRANSPORTE" ? CONTRACT_SHIPPER_VERSION : CONTRACT_DRIVER_VERSION;
}

// ---------- Aceites de contrato ----------
export const acceptContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ contract_type: z.enum(CONTRACT_TYPES) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ip = (getRequestHeader("x-forwarded-for") ?? "").split(",")[0].trim() || null;
    const version = currentVersion(data.contract_type);
    const { error } = await context.supabase
      .from("contract_acceptances")
      .upsert(
        { user_id: context.userId, contract_type: data.contract_type, version, ip },
        { onConflict: "user_id,contract_type,version" },
      );
    if (error) throw error;
    return { ok: true, version };
  });

export const hasAcceptedContract = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ contract_type: z.enum(CONTRACT_TYPES) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const version = currentVersion(data.contract_type);
    const { data: row } = await context.supabase
      .from("contract_acceptances")
      .select("id")
      .eq("user_id", context.userId)
      .eq("contract_type", data.contract_type)
      .eq("version", version)
      .maybeSingle();
    return { accepted: !!row, version };
  });

// ---------- Perfil da transportadora ----------
export const getCarrierProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("carrier_profile")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();
    return data;
  });

export const updateCarrierProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      razao_social: z.string().min(3),
      cnpj: z.string().min(14),
      ie: z.string().nullable().optional(),
      rntrc: z.string().nullable().optional(),
      endereco: z.object({
        logradouro: z.string().optional(),
        bairro: z.string().optional(),
        cidade: z.string().optional(),
        uf: z.string().optional(),
        cep: z.string().optional(),
      }),
      certificado_apelido: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Admin only (RLS já valida, mas checamos para erro claro)
    const { data: adm } = await context.supabase
      .from("admins").select("id,role").eq("user_id", context.userId).maybeSingle();
    if (!adm) throw new Error("Sem permissão");

    const { error } = await context.supabase
      .from("carrier_profile")
      .update({
        razao_social: data.razao_social,
        cnpj: data.cnpj,
        ie: data.ie ?? null,
        rntrc: data.rntrc ?? null,
        endereco: data.endereco,
        certificado_apelido: data.certificado_apelido ?? null,
      })
      .eq("singleton", true);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Margem da plataforma ----------
export const getPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("platform_settings").select("*").eq("singleton", true).maybeSingle();
    return data;
  });

export const updatePlatformMargin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ carrier_margin_percent: z.number().min(0).max(0.9) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: adm } = await context.supabase
      .from("admins").select("id").eq("user_id", context.userId).maybeSingle();
    if (!adm) throw new Error("Sem permissão");
    const { error } = await context.supabase
      .from("platform_settings")
      .update({ carrier_margin_percent: data.carrier_margin_percent })
      .eq("singleton", true);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Mock de consulta à NF-e ----------
// Determinístico a partir da chave (hash SHA-256). Contrato pronto para
// substituir por integração real (SEFAZ / Emiteaí) sem quebrar chamadas.
export const lookupNfeMock = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ key: z.string().length(44) }).parse(d))
  .handler(async ({ data }) => {
    const clean = data.key.replace(/\D/g, "");
    if (clean.length !== 44) throw new Error("Chave inválida");
    const h = createHash("sha256").update(clean).digest();
    // Distribuições pseudo-aleatórias mas determinísticas
    const pesoKg = 800 + (h.readUInt16BE(0) % 32000);            // 800 – 32800 kg
    const volumeM3 = 5 + (h.readUInt16BE(2) % 60);               // 5 – 65 m³
    const valorCarga = 5000 + (h.readUInt32BE(4) % 495000);      // R$ 5k – R$ 500k
    const cargoTypes = [
      "Grãos", "Carga Paletizada", "Container", "Refrigerada",
      "Alto Valor", "Outros",
    ];
    const cargoType = cargoTypes[h[8] % cargoTypes.length];
    const cfop = 5102 + (h[9] % 5);
    // UF fictício determinístico
    const ufs = ["SP", "MG", "PR", "RS", "SC", "GO", "MT", "BA"];
    const emitenteUf = ufs[h[10] % ufs.length];
    const destinoUf = ufs[h[11] % ufs.length];

    return {
      key: clean,
      emitente: {
        razao_social: `EMITENTE HOMOLOG ${clean.slice(0, 4)}`,
        uf: emitenteUf,
      },
      destinatario: {
        uf: destinoUf,
      },
      cargo: {
        peso_kg: pesoKg,
        volume_m3: volumeM3,
        valor_carga_reais: valorCarga,
        tipo: cargoType,
        cfop,
      },
      _simulated: true,
    };
  });
