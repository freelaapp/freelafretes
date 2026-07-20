
-- BLOCO 6 — driver_payouts
CREATE TABLE public.driver_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  gross_cents integer NOT NULL,
  inss_cents integer NOT NULL DEFAULT 0,
  sest_senat_cents integer NOT NULL DEFAULT 0,
  net_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','PAID','FAILED')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id)
);
CREATE INDEX driver_payouts_provider_idx ON public.driver_payouts(provider_id);
CREATE INDEX driver_payouts_paid_at_idx ON public.driver_payouts(paid_at);

GRANT SELECT ON public.driver_payouts TO authenticated;
GRANT ALL ON public.driver_payouts TO service_role;
ALTER TABLE public.driver_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver can read own payouts" ON public.driver_payouts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.providers p WHERE p.id = driver_payouts.provider_id AND p.user_id = auth.uid()));

CREATE POLICY "admins can read all payouts" ON public.driver_payouts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid() AND a.is_active = true));

CREATE TRIGGER trg_driver_payouts_updated BEFORE UPDATE ON public.driver_payouts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- BLOCO 7 — invoices (fatura única do embarcador)
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipper_id uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  icms_cents integer NOT NULL DEFAULT 0,
  pdf_ready boolean NOT NULL DEFAULT false,
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id)
);
CREATE INDEX invoices_shipper_idx ON public.invoices(shipper_id);
CREATE INDEX invoices_issued_at_idx ON public.invoices(issued_at);

GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipper can read own invoices" ON public.invoices FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.contractors c WHERE c.id = invoices.shipper_id AND c.user_id = auth.uid()));

CREATE POLICY "admins can read all invoices" ON public.invoices FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid() AND a.is_active = true));

CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
