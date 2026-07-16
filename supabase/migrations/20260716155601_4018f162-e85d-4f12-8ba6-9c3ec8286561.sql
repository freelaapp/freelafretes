DROP POLICY IF EXISTS "freights anon read open" ON public.freights;
REVOKE SELECT ON public.freights FROM anon;

DROP VIEW IF EXISTS public.freights_public;
CREATE VIEW public.freights_public
WITH (security_invoker = off) AS
  SELECT id, title, cargo_type, cargo_weight_kg, vehicle_types, body_types,
         origin_city, origin_uf, destination_city, destination_uf,
         distance_km, pickup_at, delivery_expected_at, status, created_at
  FROM public.freights
  WHERE status = 'OPEN';

GRANT SELECT ON public.freights_public TO anon, authenticated;