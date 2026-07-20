
ALTER TABLE public.freight_documents
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS parent_doc_id uuid REFERENCES public.freight_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS freight_documents_parent_idx ON public.freight_documents(parent_doc_id);
CREATE INDEX IF NOT EXISTS freight_documents_event_type_idx ON public.freight_documents(event_type);
