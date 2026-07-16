
-- 1) Remove anon full-row access to freights; anon must go through the freights_public view
DROP POLICY IF EXISTS "freights anon read open safe" ON public.freights;
REVOKE SELECT ON public.freights FROM anon;

-- 2) Ensure the freight branch of the scoped read policy only serves authenticated users
DROP POLICY IF EXISTS "freights read scoped" ON public.freights;
CREATE POLICY "freights read scoped"
ON public.freights FOR SELECT TO authenticated
USING (
  (status = 'OPEN'::freight_status)
  OR EXISTS (SELECT 1 FROM public.contractors c WHERE c.id = freights.contractor_id AND c.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.candidacies ca JOIN public.providers p ON p.id = ca.provider_id WHERE ca.freight_id = freights.id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.jobs j JOIN public.providers p ON p.id = j.provider_id WHERE j.freight_id = freights.id AND p.user_id = auth.uid())
);

-- 3) Candidacies insert must verify the vehicle belongs to the same provider
DROP POLICY IF EXISTS "candidacies driver insert" ON public.candidacies;
CREATE POLICY "candidacies driver insert"
ON public.candidacies FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.id = candidacies.provider_id AND p.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = candidacies.vehicle_id AND v.provider_id = candidacies.provider_id
  )
);

-- 4) realtime.messages: add a default-deny RLS policy so Broadcast/Presence
-- private channels cannot leak between users. The app only uses postgres_changes
-- subscriptions, so denying all direct realtime.messages access is safe.
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "deny all broadcast presence" ON realtime.messages';
    EXECUTE 'CREATE POLICY "deny all broadcast presence" ON realtime.messages FOR ALL TO authenticated, anon USING (false) WITH CHECK (false)';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
