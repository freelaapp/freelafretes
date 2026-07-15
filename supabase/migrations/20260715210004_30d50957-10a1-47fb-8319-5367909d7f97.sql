-- 1) Move SECURITY DEFINER helper functions out of the API-exposed public schema
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

ALTER FUNCTION public.is_admin(uuid) SET SCHEMA private;
ALTER FUNCTION public.is_super_admin(uuid) SET SCHEMA private;
ALTER FUNCTION public.has_role(uuid, public.user_role) SET SCHEMA private;

REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_super_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.user_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION private.is_super_admin(uuid) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.user_role) TO postgres, service_role;

-- 2) Remove public/anon SELECT on pricing config tables; admins keep access via their ALL policy
DROP POLICY IF EXISTS "pricing_settings read all" ON public.pricing_settings;
DROP POLICY IF EXISTS "pricing_cargo_factors read all" ON public.pricing_cargo_factors;
DROP POLICY IF EXISTS "pricing_vehicle_costs read all" ON public.pricing_vehicle_costs;

REVOKE SELECT ON public.pricing_settings FROM anon;
REVOKE SELECT ON public.pricing_cargo_factors FROM anon;
REVOKE SELECT ON public.pricing_vehicle_costs FROM anon;