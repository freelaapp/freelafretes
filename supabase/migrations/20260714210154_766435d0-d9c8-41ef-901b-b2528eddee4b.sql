
-- =========================================================
-- MOTOR DE PRECIFICAÇÃO
-- =========================================================

-- Custos por veículo
CREATE TABLE public.pricing_vehicle_costs (
  vehicle_type text PRIMARY KEY,
  ckm_cents_por_km integer NOT NULL,
  frete_minimo_cents integer NOT NULL,
  capacidade_kg integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pricing_vehicle_costs TO anon, authenticated;
GRANT ALL ON public.pricing_vehicle_costs TO service_role;
ALTER TABLE public.pricing_vehicle_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_vehicle_costs read all" ON public.pricing_vehicle_costs FOR SELECT USING (true);
CREATE POLICY "pricing_vehicle_costs admin write" ON public.pricing_vehicle_costs FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.pricing_vehicle_costs (vehicle_type, ckm_cents_por_km, frete_minimo_cents, capacidade_kg) VALUES
  ('vlc',      220, 15000, 1500),
  ('toco',     320, 25000, 6000),
  ('truck',    400, 35000, 12000),
  ('bitruck',  460, 40000, 18000),
  ('carreta',  550, 55000, 32000),
  ('bitrem',   650, 65000, 45000),
  ('rodotrem', 720, 75000, 60000);

-- Fatores por tipo de carga
CREATE TABLE public.pricing_cargo_factors (
  cargo_type text PRIMARY KEY,
  factor numeric(4,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pricing_cargo_factors TO anon, authenticated;
GRANT ALL ON public.pricing_cargo_factors TO service_role;
ALTER TABLE public.pricing_cargo_factors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_cargo_factors read all" ON public.pricing_cargo_factors FOR SELECT USING (true);
CREATE POLICY "pricing_cargo_factors admin write" ON public.pricing_cargo_factors FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.pricing_cargo_factors (cargo_type, factor) VALUES
  ('graos', 1.00),
  ('paletizada', 1.00),
  ('granel_liquido', 1.10),
  ('refrigerada', 1.25),
  ('mudanca', 1.15),
  ('veiculos', 1.20),
  ('container', 1.10),
  ('carga_perigosa', 1.40),
  ('alto_valor', 1.30),
  ('outros', 1.00);

-- Settings singleton (jsonb)
CREATE TABLE public.pricing_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  settings jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT pricing_settings_singleton CHECK (id = 1)
);
GRANT SELECT ON public.pricing_settings TO anon, authenticated;
GRANT ALL ON public.pricing_settings TO service_role;
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_settings read all" ON public.pricing_settings FOR SELECT USING (true);
CREATE POLICY "pricing_settings admin write" ON public.pricing_settings FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.pricing_settings (id, settings) VALUES (1, jsonb_build_object(
  'peso_cubado_kg_por_m3', 300,
  'toll_cents_por_km', 12,
  'seguro_percent_valor_carga', 0.15,
  'seguro_min_cents', 3000,
  'gris_percent_rota_risco', 0.10,
  'adicional_ajudante_cents', 15000,
  'adicional_carga_descarga_cents', 20000,
  'adicional_espera_cents_hora', 8000,
  'adicional_equipamento_cents', 12000,
  'fator_urgencia_24h', 1.15,
  'fator_urgencia_48h', 1.08,
  'fator_noturno', 1.05,
  'fator_rota_risco', 1.08,
  'fd_min', 0.90,
  'fd_max', 1.25,
  'meses_safra', jsonb_build_array(2,3,4,7,8),
  'safra_boost', 0.10
));

-- Histórico de alterações
CREATE TABLE public.pricing_settings_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid,
  entity text NOT NULL, -- 'settings' | 'vehicle_costs' | 'cargo_factors'
  entity_key text,
  before jsonb,
  after jsonb
);
GRANT SELECT, INSERT ON public.pricing_settings_history TO authenticated;
GRANT ALL ON public.pricing_settings_history TO service_role;
ALTER TABLE public.pricing_settings_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_history admin read" ON public.pricing_settings_history FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "pricing_history admin insert" ON public.pricing_settings_history FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

-- Colunas em freights
ALTER TABLE public.freights
  ADD COLUMN IF NOT EXISTS suggested_amount_in_cents integer,
  ADD COLUMN IF NOT EXISTS pricing_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS pricing_factors jsonb;
