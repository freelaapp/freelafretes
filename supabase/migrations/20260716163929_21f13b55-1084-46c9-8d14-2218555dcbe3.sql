
-- Recreate view with security_invoker=on
DROP VIEW IF EXISTS public.freights_public;
CREATE VIEW public.freights_public
WITH (security_invoker = on) AS
SELECT id, title, cargo_type, cargo_weight_kg, vehicle_types, body_types,
       origin_city, origin_uf, destination_city, destination_uf,
       distance_km, pickup_at, delivery_expected_at, status, created_at
FROM public.freights
WHERE status = 'OPEN';

GRANT SELECT ON public.freights_public TO anon, authenticated;

-- Column-level grants so anon can only read safe columns even if querying freights directly
REVOKE SELECT ON public.freights FROM anon;
GRANT SELECT (id, title, cargo_type, cargo_weight_kg, vehicle_types, body_types,
              origin_city, origin_uf, destination_city, destination_uf,
              distance_km, pickup_at, delivery_expected_at, status, created_at)
  ON public.freights TO anon;

-- Anon RLS: only OPEN freights visible
DROP POLICY IF EXISTS "freights anon read open safe" ON public.freights;
CREATE POLICY "freights anon read open safe"
ON public.freights FOR SELECT TO anon
USING (status = 'OPEN');
