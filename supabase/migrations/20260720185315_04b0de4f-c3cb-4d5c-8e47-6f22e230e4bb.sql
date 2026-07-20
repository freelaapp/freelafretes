
-- BLOCO 0: modelo comercial
ALTER TABLE public.freights
  ADD COLUMN IF NOT EXISTS freight_value_cents integer,
  ADD COLUMN IF NOT EXISTS driver_payout_cents integer,
  ADD COLUMN IF NOT EXISTS platform_margin_cents integer,
  ADD COLUMN IF NOT EXISTS nfe_key text,
  ADD COLUMN IF NOT EXISTS nfe_summary jsonb;

UPDATE public.freights
SET
  freight_value_cents = COALESCE(freight_value_cents, base_amount_in_cents),
  driver_payout_cents = COALESCE(driver_payout_cents, ROUND(base_amount_in_cents * 0.80)::int),
  platform_margin_cents = COALESCE(platform_margin_cents, base_amount_in_cents - ROUND(base_amount_in_cents * 0.80)::int)
WHERE base_amount_in_cents IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_margin_percent numeric NOT NULL DEFAULT 0.20 CHECK (carrier_margin_percent >= 0 AND carrier_margin_percent < 1),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_settings read authenticated"
  ON public.platform_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "platform_settings admin write"
  ON public.platform_settings FOR ALL TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));

CREATE TRIGGER platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_settings (carrier_margin_percent) VALUES (0.20)
  ON CONFLICT DO NOTHING;

-- BLOCO 1: identidade transportadora + contratos
CREATE TABLE IF NOT EXISTS public.carrier_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  razao_social text NOT NULL,
  cnpj text NOT NULL,
  ie text,
  rntrc text,
  endereco jsonb NOT NULL DEFAULT '{}'::jsonb,
  certificado_apelido text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.carrier_profile TO authenticated;
GRANT ALL ON public.carrier_profile TO service_role;

ALTER TABLE public.carrier_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carrier_profile read authenticated"
  ON public.carrier_profile FOR SELECT TO authenticated USING (true);

CREATE POLICY "carrier_profile admin write"
  ON public.carrier_profile FOR ALL TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));

CREATE TRIGGER carrier_profile_updated_at
  BEFORE UPDATE ON public.carrier_profile
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.carrier_profile (razao_social, cnpj, ie, rntrc, endereco, certificado_apelido)
VALUES (
  'FREELA FRETES TRANSPORTES LTDA — DADOS DE HOMOLOGAÇÃO',
  '00.000.000/0001-00',
  'ISENTO',
  '00000000',
  '{"logradouro":"Av. Homologação, 1000","bairro":"Centro","cidade":"São Paulo","uf":"SP","cep":"01000-000"}'::jsonb,
  'freela-homolog'
) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.contract_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_type text NOT NULL CHECK (contract_type IN ('EMBARCADOR_TRANSPORTE','TAC_SUBCONTRATACAO')),
  version text NOT NULL,
  ip text,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, contract_type, version)
);

GRANT SELECT, INSERT ON public.contract_acceptances TO authenticated;
GRANT ALL ON public.contract_acceptances TO service_role;

ALTER TABLE public.contract_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_acceptances self read"
  ON public.contract_acceptances FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.is_admin(auth.uid()));

CREATE POLICY "contract_acceptances self insert"
  ON public.contract_acceptances FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_contract_acceptances_user_type
  ON public.contract_acceptances (user_id, contract_type);
