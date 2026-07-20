DROP POLICY IF EXISTS "carrier_profile read authenticated" ON public.carrier_profile;
DROP POLICY IF EXISTS "platform_settings read authenticated" ON public.platform_settings;
DROP POLICY IF EXISTS "self insert own non-admin role" ON public.user_roles;