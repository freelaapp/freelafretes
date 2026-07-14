
DROP POLICY IF EXISTS "freights read auth" ON public.freights;
CREATE POLICY "freights read scoped" ON public.freights FOR SELECT TO authenticated
USING (
  status = 'OPEN'::freight_status
  OR EXISTS (SELECT 1 FROM public.contractors c WHERE c.id = freights.contractor_id AND c.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.candidacies ca JOIN public.providers p ON p.id = ca.provider_id WHERE ca.freight_id = freights.id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.jobs j JOIN public.providers p ON p.id = j.provider_id WHERE j.freight_id = freights.id AND p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "providers basic read auth" ON public.providers;
CREATE POLICY "providers read counterparties" ON public.providers FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.candidacies ca JOIN public.freights f ON f.id = ca.freight_id JOIN public.contractors c ON c.id = f.contractor_id WHERE ca.provider_id = providers.id AND c.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.jobs j JOIN public.contractors c ON c.id = j.contractor_id WHERE j.provider_id = providers.id AND c.user_id = auth.uid())
);

DROP POLICY IF EXISTS "vehicles read auth" ON public.vehicles;
CREATE POLICY "vehicles read scoped" ON public.vehicles FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.providers p WHERE p.id = vehicles.provider_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.candidacies ca JOIN public.freights f ON f.id = ca.freight_id JOIN public.contractors c ON c.id = f.contractor_id WHERE ca.vehicle_id = vehicles.id AND c.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.jobs j JOIN public.candidacies ca ON ca.freight_id = j.freight_id AND ca.provider_id = j.provider_id JOIN public.contractors c ON c.id = j.contractor_id WHERE ca.vehicle_id = vehicles.id AND c.user_id = auth.uid())
);
