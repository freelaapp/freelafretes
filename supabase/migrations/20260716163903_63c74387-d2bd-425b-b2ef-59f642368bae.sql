
DROP VIEW IF EXISTS public.freights_public;
DROP FUNCTION IF EXISTS public.freights_public();

CREATE VIEW public.freights_public
WITH (security_invoker = off) AS
SELECT id, title, cargo_type, cargo_weight_kg, vehicle_types, body_types,
       origin_city, origin_uf, destination_city, destination_uf,
       distance_km, pickup_at, delivery_expected_at, status, created_at
FROM public.freights
WHERE status = 'OPEN';

GRANT SELECT ON public.freights_public TO anon, authenticated;

DROP POLICY IF EXISTS "candidacies driver update own" ON public.candidacies;
CREATE POLICY "candidacies driver update own"
ON public.candidacies FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.providers p WHERE p.id = candidacies.provider_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.providers p WHERE p.id = candidacies.provider_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "freights owner update" ON public.freights;
CREATE POLICY "freights owner update"
ON public.freights FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.contractors c WHERE c.id = freights.contractor_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.contractors c WHERE c.id = freights.contractor_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "jobs update parties" ON public.jobs;
CREATE POLICY "jobs update parties"
ON public.jobs FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.providers p WHERE p.id = jobs.provider_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.contractors c WHERE c.id = jobs.contractor_id AND c.user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.providers p WHERE p.id = jobs.provider_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.contractors c WHERE c.id = jobs.contractor_id AND c.user_id = auth.uid())
);

DROP POLICY IF EXISTS "vehicles owner update" ON public.vehicles;
CREATE POLICY "vehicles owner update"
ON public.vehicles FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.providers p WHERE p.id = vehicles.provider_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.providers p WHERE p.id = vehicles.provider_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "self insert own non-admin role" ON public.user_roles;
CREATE POLICY "self insert own non-admin role"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role IN ('contractor','provider')
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
);
