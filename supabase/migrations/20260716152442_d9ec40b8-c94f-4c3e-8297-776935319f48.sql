
ALTER TABLE public.providers
  ADD COLUMN validation_status public.validation_status,
  ADD COLUMN validation_notes text,
  ADD COLUMN validated_at timestamptz,
  ADD COLUMN cnh_document_url text,
  ADD COLUMN cnh_back_url text,
  ADD COLUMN address_proof_url text,
  ADD COLUMN selfie_url text,
  ADD COLUMN bank_code text,
  ADD COLUMN bank_agency text,
  ADD COLUMN bank_account text,
  ADD COLUMN pix_key text,
  ADD COLUMN pix_key_type text;

UPDATE public.providers SET validation_status = 'APPROVED', validated_at = COALESCE(validated_at, now());

ALTER TABLE public.providers
  ALTER COLUMN validation_status SET NOT NULL,
  ALTER COLUMN validation_status SET DEFAULT 'PENDING_VALIDATION',
  ADD CONSTRAINT providers_pix_key_type_check
    CHECK (pix_key_type IS NULL OR pix_key_type IN ('cpf','email','phone','random'));
