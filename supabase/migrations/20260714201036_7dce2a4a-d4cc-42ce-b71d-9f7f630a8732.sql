
-- 1. Remove anon SELECT on raw freights table (addresses/CEP/pricing leak).
-- Public data continues to be exposed via the safe freights_public view.
DROP POLICY IF EXISTS "freights anon read open" ON public.freights;

-- 2. Explicit admin-only INSERT policy on user_roles (makes intent explicit).
DROP POLICY IF EXISTS "admin insert user_roles" ON public.user_roles;
CREATE POLICY "admin insert user_roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- 3. Lock down SECURITY DEFINER functions.
-- Drop publicly-callable aggregator; will be served by an authenticated-only server fn using the service role.
DROP FUNCTION IF EXISTS public.public_stats();

-- Role helpers must remain callable only where needed by RLS; revoke public/anon EXECUTE.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.user_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.user_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
