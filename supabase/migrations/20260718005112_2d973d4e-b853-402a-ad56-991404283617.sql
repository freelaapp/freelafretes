
CREATE TABLE public.freight_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('CTE','MDFE','CIOT','AVERBACAO')),
  doc_number TEXT,
  access_key TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ISSUED','CANCELLED')),
  issued_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider TEXT NOT NULL DEFAULT 'EMITEAI_MOCK',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_freight_documents_job ON public.freight_documents(job_id);

GRANT SELECT ON public.freight_documents TO authenticated;
GRANT ALL ON public.freight_documents TO service_role;

ALTER TABLE public.freight_documents ENABLE ROW LEVEL SECURITY;

-- Embarcador (contractor do job) lê
CREATE POLICY "Contractor reads own freight documents"
ON public.freight_documents FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.jobs j
  JOIN public.contractors c ON c.id = j.contractor_id
  WHERE j.id = freight_documents.job_id AND c.user_id = auth.uid()
));

-- Motorista (provider do job) lê
CREATE POLICY "Provider reads own freight documents"
ON public.freight_documents FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.jobs j
  JOIN public.providers p ON p.id = j.provider_id
  WHERE j.id = freight_documents.job_id AND p.user_id = auth.uid()
));

-- Admin lê tudo
CREATE POLICY "Admins read all freight documents"
ON public.freight_documents FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.admins a
  WHERE a.user_id = auth.uid() AND a.is_active = true
));

-- Nenhuma policy de INSERT/UPDATE/DELETE para authenticated => escrita só via service_role.

CREATE TRIGGER trg_freight_documents_updated_at
BEFORE UPDATE ON public.freight_documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
