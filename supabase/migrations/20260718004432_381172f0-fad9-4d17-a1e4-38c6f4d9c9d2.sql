
ALTER TABLE public.pricing_vehicle_costs
  ADD COLUMN IF NOT EXISTS axles integer;

UPDATE public.pricing_vehicle_costs SET axles = CASE vehicle_type
  WHEN 'vlc' THEN 2 WHEN 'toco' THEN 2 WHEN 'truck' THEN 3
  WHEN 'bitruck' THEN 4 WHEN 'carreta' THEN 5
  WHEN 'bitrem' THEN 7 WHEN 'rodotrem' THEN 9
  ELSE axles END
WHERE axles IS NULL OR axles = 0;

CREATE TABLE IF NOT EXISTS public.antt_floor_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_axles integer NOT NULL,
  cargo_category text NOT NULL,
  rate_per_km_cents integer NOT NULL,
  load_unload_cents integer NOT NULL DEFAULT 0,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS antt_floor_rates_lookup_idx
  ON public.antt_floor_rates (vehicle_axles, cargo_category, valid_from DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.antt_floor_rates TO authenticated;
GRANT ALL ON public.antt_floor_rates TO service_role;
ALTER TABLE public.antt_floor_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage antt rates" ON public.antt_floor_rates;
CREATE POLICY "admins manage antt rates"
  ON public.antt_floor_rates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid() AND a.is_active))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid() AND a.is_active));

INSERT INTO public.antt_floor_rates (vehicle_axles, cargo_category, rate_per_km_cents, load_unload_cents, notes)
SELECT v.axles, c.cat, ROUND(v.base_val * c.mult)::int, 20000,
       'PLACEHOLDER — atualizar com Resolução ANTT vigente'
FROM (VALUES (2,250),(3,320),(4,400),(5,470),(7,570),(9,660)) AS v(axles, base_val)
CROSS JOIN (VALUES
  ('geral', 1.00),
  ('granel_solido', 1.00),
  ('granel_liquido', 1.10),
  ('frigorificada', 1.25),
  ('conteineirizada', 1.05),
  ('perigosa_geral', 1.30)
) AS c(cat, mult)
WHERE NOT EXISTS (
  SELECT 1 FROM public.antt_floor_rates r
  WHERE r.vehicle_axles = v.axles AND r.cargo_category = c.cat AND r.valid_to IS NULL
);
