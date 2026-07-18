
ALTER TABLE public.freights
  ADD COLUMN IF NOT EXISTS freight_mode text NOT NULL DEFAULT 'LOTACAO'
    CHECK (freight_mode IN ('LOTACAO','FRACIONADO')),
  ADD COLUMN IF NOT EXISTS cargo_volume_m3 numeric(10,2),
  ADD COLUMN IF NOT EXISTS mode_suggested text
    CHECK (mode_suggested IN ('LOTACAO','FRACIONADO')),
  ADD COLUMN IF NOT EXISTS mode_override boolean NOT NULL DEFAULT false;

ALTER TABLE public.pricing_vehicle_costs
  ADD COLUMN IF NOT EXISTS capacidade_m3 numeric(10,2);

UPDATE public.pricing_vehicle_costs SET capacidade_m3 = CASE vehicle_type
  WHEN 'vlc' THEN 12
  WHEN 'toco' THEN 40
  WHEN 'truck' THEN 55
  WHEN 'bitruck' THEN 65
  WHEN 'carreta' THEN 90
  WHEN 'bitrem' THEN 120
  WHEN 'rodotrem' THEN 140
  ELSE capacidade_m3
END WHERE capacidade_m3 IS NULL;

DROP VIEW IF EXISTS public.freights_public;
CREATE VIEW public.freights_public
WITH (security_invoker = on) AS
SELECT id, title, cargo_type, cargo_weight_kg, cargo_volume_m3,
       freight_mode, vehicle_types, body_types,
       origin_city, origin_uf, destination_city, destination_uf,
       distance_km, pickup_at, delivery_expected_at, status, created_at
FROM public.freights
WHERE status = 'OPEN'::freight_status;

GRANT SELECT (id, title, cargo_type, cargo_weight_kg, cargo_volume_m3,
              freight_mode, vehicle_types, body_types,
              origin_city, origin_uf, destination_city, destination_uf,
              distance_km, pickup_at, delivery_expected_at, status, created_at)
  ON public.freights_public TO anon, authenticated;
