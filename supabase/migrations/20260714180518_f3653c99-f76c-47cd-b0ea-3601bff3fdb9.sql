
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.user_role AS ENUM ('contractor', 'provider');
CREATE TYPE public.validation_status AS ENUM ('PENDING_VALIDATION', 'APPROVED', 'REJECTED');
CREATE TYPE public.freight_status AS ENUM ('OPEN', 'CLOSED', 'CANCELLED', 'CANCELLED_BY_CONTRACTOR');
CREATE TYPE public.candidacy_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED_BY_CONTRACTOR', 'WITHDRAWN');
CREATE TYPE public.job_status AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE public.payment_status AS ENUM ('PENDING', 'COMPLETED', 'REFUNDED');
CREATE TYPE public.payment_method AS ENUM ('PIX');
CREATE TYPE public.feedback_role AS ENUM ('PROVIDER', 'CONTRACTOR');

-- ============================================================
-- HELPER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============================================================
-- USER ROLES (evita recursão de RLS)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.user_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- ============================================================
-- CONTRACTORS
-- ============================================================
CREATE TABLE public.contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  corporate_reason TEXT NOT NULL,
  cnpj TEXT NOT NULL UNIQUE,
  cpf TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  is_company_partner BOOLEAN NOT NULL DEFAULT false,
  segment TEXT NOT NULL,
  monthly_freight_volume TEXT NOT NULL,
  city TEXT,
  uf TEXT,
  validation_status public.validation_status NOT NULL DEFAULT 'PENDING_VALIDATION',
  validated_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.contractors TO authenticated;
GRANT ALL ON public.contractors TO service_role;
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contractors self read" ON public.contractors FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "contractors self insert" ON public.contractors FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contractors self update" ON public.contractors FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_contractors_updated BEFORE UPDATE ON public.contractors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- PROVIDERS
-- ============================================================
CREATE TABLE public.providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  birthdate DATE NOT NULL,
  cnh_number TEXT NOT NULL,
  cnh_category TEXT NOT NULL,
  cnh_expires_at DATE NOT NULL,
  city TEXT NOT NULL,
  uf TEXT NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.providers TO authenticated;
GRANT ALL ON public.providers TO service_role;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "providers self read" ON public.providers FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Motoristas visíveis a embarcadores que veem propostas (evita join complexo — permitimos leitura básica autenticada)
CREATE POLICY "providers basic read auth" ON public.providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "providers self insert" ON public.providers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "providers self update" ON public.providers FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_providers_updated BEFORE UPDATE ON public.providers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- VEHICLES
-- ============================================================
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL,
  body_type TEXT NOT NULL,
  plate TEXT NOT NULL UNIQUE,
  capacity_kg INTEGER NOT NULL CHECK (capacity_kg > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles read auth" ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "vehicles owner insert" ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.user_id = auth.uid()));
CREATE POLICY "vehicles owner update" ON public.vehicles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.user_id = auth.uid()));
CREATE POLICY "vehicles owner delete" ON public.vehicles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.user_id = auth.uid()));

-- ============================================================
-- FREIGHTS
-- ============================================================
CREATE TABLE public.freights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cargo_type TEXT NOT NULL,
  cargo_weight_kg INTEGER NOT NULL CHECK (cargo_weight_kg > 0),
  vehicle_types TEXT[] NOT NULL DEFAULT '{}',
  body_types TEXT[] NOT NULL DEFAULT '{}',
  origin_city TEXT NOT NULL,
  origin_uf TEXT NOT NULL,
  origin_address TEXT,
  origin_cep TEXT,
  destination_city TEXT NOT NULL,
  destination_uf TEXT NOT NULL,
  destination_address TEXT,
  destination_cep TEXT,
  distance_km INTEGER NOT NULL CHECK (distance_km > 0),
  pickup_at TIMESTAMPTZ NOT NULL,
  delivery_expected_at TIMESTAMPTZ,
  toll_included BOOLEAN NOT NULL DEFAULT false,
  payment NUMERIC(12,2) NOT NULL CHECK (payment > 0),
  base_amount_in_cents INTEGER NOT NULL CHECK (base_amount_in_cents > 0),
  agreed_amount_in_cents INTEGER,
  status public.freight_status NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.freights TO authenticated;
GRANT ALL ON public.freights TO service_role;
ALTER TABLE public.freights ENABLE ROW LEVEL SECURITY;
-- Autenticados leem qualquer frete (motoristas precisam ver todos os OPEN; embarcadores veem os seus)
CREATE POLICY "freights read auth" ON public.freights FOR SELECT TO authenticated USING (true);
CREATE POLICY "freights owner insert" ON public.freights FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.contractors c WHERE c.id = contractor_id AND c.user_id = auth.uid()));
CREATE POLICY "freights owner update" ON public.freights FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contractors c WHERE c.id = contractor_id AND c.user_id = auth.uid()));

-- View pública sem valor
CREATE VIEW public.freights_public WITH (security_invoker=on) AS
  SELECT id, title, cargo_type, cargo_weight_kg, vehicle_types, body_types,
         origin_city, origin_uf, destination_city, destination_uf,
         distance_km, pickup_at, delivery_expected_at, status, created_at
  FROM public.freights WHERE status = 'OPEN';
GRANT SELECT ON public.freights_public TO anon, authenticated;

CREATE TRIGGER trg_freights_updated BEFORE UPDATE ON public.freights FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Política pública anon para vitrine (via view usa security_invoker; precisamos permitir SELECT em freights para anon)
CREATE POLICY "freights anon read open" ON public.freights FOR SELECT TO anon USING (status = 'OPEN');
GRANT SELECT (id, title, cargo_type, cargo_weight_kg, vehicle_types, body_types,
              origin_city, origin_uf, destination_city, destination_uf,
              distance_km, pickup_at, delivery_expected_at, status, created_at)
  ON public.freights TO anon;

-- ============================================================
-- CANDIDACIES
-- ============================================================
CREATE TABLE public.candidacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  proposed_amount_in_cents INTEGER CHECK (proposed_amount_in_cents IS NULL OR proposed_amount_in_cents > 0),
  message TEXT,
  status public.candidacy_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (freight_id, provider_id)
);
GRANT SELECT, INSERT, UPDATE ON public.candidacies TO authenticated;
GRANT ALL ON public.candidacies TO service_role;
ALTER TABLE public.candidacies ENABLE ROW LEVEL SECURITY;

-- Motorista dono da proposta OU embarcador dono do frete
CREATE POLICY "candidacies read parties" ON public.candidacies FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.freights f JOIN public.contractors c ON c.id = f.contractor_id
             WHERE f.id = freight_id AND c.user_id = auth.uid())
);
CREATE POLICY "candidacies driver insert" ON public.candidacies FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.user_id = auth.uid())
);
CREATE POLICY "candidacies driver update own" ON public.candidacies FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.user_id = auth.uid())
);
CREATE TRIGGER trg_candidacies_updated BEFORE UPDATE ON public.candidacies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- JOBS (viagens)
-- ============================================================
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL UNIQUE REFERENCES public.freights(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.providers(id),
  contractor_id UUID NOT NULL REFERENCES public.contractors(id),
  agreed_amount_in_cents INTEGER NOT NULL,
  status public.job_status NOT NULL DEFAULT 'SCHEDULED',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs read parties" ON public.jobs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.contractors c WHERE c.id = contractor_id AND c.user_id = auth.uid())
);
CREATE POLICY "jobs update parties" ON public.jobs FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.contractors c WHERE c.id = contractor_id AND c.user_id = auth.uid())
);
CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- CHECK_INS / CHECK_OUTS
-- ============================================================
CREATE TABLE public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  validated_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.check_ins TO authenticated;
GRANT ALL ON public.check_ins TO service_role;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "check_ins parties" ON public.check_ins FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.jobs j
    LEFT JOIN public.providers p ON p.id = j.provider_id
    LEFT JOIN public.contractors c ON c.id = j.contractor_id
    WHERE j.id = job_id AND (p.user_id = auth.uid() OR c.user_id = auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.jobs j
    LEFT JOIN public.providers p ON p.id = j.provider_id
    LEFT JOIN public.contractors c ON c.id = j.contractor_id
    WHERE j.id = job_id AND (p.user_id = auth.uid() OR c.user_id = auth.uid()))
);

CREATE TABLE public.check_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  validated_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.check_outs TO authenticated;
GRANT ALL ON public.check_outs TO service_role;
ALTER TABLE public.check_outs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "check_outs parties" ON public.check_outs FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.jobs j
    LEFT JOIN public.providers p ON p.id = j.provider_id
    LEFT JOIN public.contractors c ON c.id = j.contractor_id
    WHERE j.id = job_id AND (p.user_id = auth.uid() OR c.user_id = auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.jobs j
    LEFT JOIN public.providers p ON p.id = j.provider_id
    LEFT JOIN public.contractors c ON c.id = j.contractor_id
    WHERE j.id = job_id AND (p.user_id = auth.uid() OR c.user_id = auth.uid()))
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
  amount_in_cents INTEGER NOT NULL,
  service_fee_in_cents INTEGER NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'PENDING',
  method public.payment_method NOT NULL DEFAULT 'PIX',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments parties" ON public.payments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.jobs j
    LEFT JOIN public.providers p ON p.id = j.provider_id
    LEFT JOIN public.contractors c ON c.id = j.contractor_id
    WHERE j.id = job_id AND (p.user_id = auth.uid() OR c.user_id = auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.jobs j
    LEFT JOIN public.contractors c ON c.id = j.contractor_id
    WHERE j.id = job_id AND c.user_id = auth.uid())
);

-- ============================================================
-- FEEDBACKS
-- ============================================================
CREATE TABLE public.feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.feedback_role NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, author_id, role)
);
GRANT SELECT, INSERT ON public.feedbacks TO authenticated;
GRANT ALL ON public.feedbacks TO service_role;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedbacks read parties" ON public.feedbacks FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.jobs j
    LEFT JOIN public.providers p ON p.id = j.provider_id
    LEFT JOIN public.contractors c ON c.id = j.contractor_id
    WHERE j.id = job_id AND (p.user_id = auth.uid() OR c.user_id = auth.uid()))
);
CREATE POLICY "feedbacks author insert" ON public.feedbacks FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = author_id
  AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.status = 'COMPLETED')
);

-- ============================================================
-- Seed placeholder contractor (usada para os 8 fretes iniciais)
-- Insere um contractor com user_id nulo? Não é permitido. Usaremos service_role para seed via app.
-- Vamos criar uma linha "system" só se possível; caso contrário, o seed vem depois via server fn ou insert tool.
-- ============================================================
