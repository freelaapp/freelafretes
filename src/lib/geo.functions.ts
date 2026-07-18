import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const resolveCityCoords = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ city: z.string().min(1), uf: z.string().length(2) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("br_cities")
      .select("lat,lng,city,uf")
      .eq("uf", data.uf.toUpperCase())
      .eq("city_normalized", normalize(data.city))
      .maybeSingle();
    if (!rows) return { lat: null, lng: null };
    return { lat: Number(rows.lat), lng: Number(rows.lng) };
  });

export const listCitiesByUf = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ uf: z.string().length(2) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("br_cities").select("city,lat,lng").eq("uf", data.uf.toUpperCase()).order("city");
    return rows ?? [];
  });

export const updateDriverBase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    city: z.string().min(1),
    uf: z.string().length(2),
    search_radius_km: z.number().int().min(50).max(3000).default(300),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin
      .from("br_cities").select("lat,lng").eq("uf", data.uf.toUpperCase())
      .eq("city_normalized", normalize(data.city)).maybeSingle();
    if (!c) throw new Error("Cidade não encontrada em nossa base. Selecione uma das capitais/principais cidades listadas.");
    const { error } = await context.supabase.from("providers").update({
      city: data.city, uf: data.uf.toUpperCase(),
      base_lat: c.lat, base_lng: c.lng,
      search_radius_km: data.search_radius_km,
    }).eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
