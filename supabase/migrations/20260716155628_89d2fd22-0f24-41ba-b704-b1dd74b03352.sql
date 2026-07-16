DROP VIEW IF EXISTS public.freights_public;

CREATE OR REPLACE FUNCTION public.freights_public()
RETURNS TABLE (
  id uuid,
  title text,
  cargo_type text,
  cargo_weight_kg numeric,
  vehicle_types text[],
  body_types text[],
  origin_city text,
  origin_uf text,
  destination_city text,
  destination_uf text,
  distance_km numeric,
  pickup_at timestamptz,
  delivery_expected_at timestamptz,
  status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, title, cargo_type, cargo_weight_kg, vehicle_types, body_types,
         origin_city, origin_uf, destination_city, destination_uf,
         distance_km, pickup_at, delivery_expected_at, status, created_at
  FROM public.freights
  WHERE status = 'OPEN'
$$;

REVOKE EXECUTE ON FUNCTION public.freights_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.freights_public() TO anon, authenticated;

-- Recreate view as a thin wrapper with security_invoker=on so it inherits caller perms;
-- underlying function is SECURITY DEFINER and only exposes safe columns.
CREATE VIEW public.freights_public
WITH (security_invoker = on) AS
  SELECT * FROM public.freights_public();

GRANT SELECT ON public.freights_public TO anon, authenticated;