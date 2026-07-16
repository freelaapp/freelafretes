
-- ============ trip_events ============
CREATE TABLE public.trip_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('ARRIVED_PICKUP','LOADING_FINISHED','TRIP_STARTED','REST_STARTED','REST_ENDED','ARRIVED_DESTINATION','UNLOADING_STARTED','UNLOADING_FINISHED','INCIDENT_REPORTED')),
  notes text,
  incident_kind text CHECK (incident_kind IN ('ACCIDENT','THEFT','BREAKDOWN','DAMAGE')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trip_events_job_id_idx ON public.trip_events(job_id, created_at);

GRANT SELECT, INSERT ON public.trip_events TO authenticated;
GRANT ALL ON public.trip_events TO service_role;

ALTER TABLE public.trip_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_events read parties" ON public.trip_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.jobs j
    LEFT JOIN public.providers p ON p.id = j.provider_id
    LEFT JOIN public.contractors c ON c.id = j.contractor_id
    WHERE j.id = trip_events.job_id AND (p.user_id = auth.uid() OR c.user_id = auth.uid())
  ));

CREATE POLICY "trip_events driver insert" ON public.trip_events
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.providers p ON p.id = j.provider_id
    WHERE j.id = trip_events.job_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "trip_events admin read" ON public.trip_events
  FOR SELECT TO authenticated USING (private.is_admin(auth.uid()));
CREATE POLICY "trip_events admin all" ON public.trip_events
  FOR ALL TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

-- ============ notifications ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON public.notifications(user_id) WHERE read_at IS NULL;

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications owner read" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications owner update" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications admin read" ON public.notifications
  FOR SELECT TO authenticated USING (private.is_admin(auth.uid()));

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_events;
