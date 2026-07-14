
-- Admin panel schema

-- 1. Add RELEASED to payment_status
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'RELEASED';

-- 2. Column additions
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS validation_notes text;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS ban_reason text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS disputed boolean NOT NULL DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS dispute_notes text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS force_completed_by uuid;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS force_completed_reason text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS released_at timestamptz;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refunded_at timestamptz;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refund_reason text;
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS hidden_reason text;

-- 3. admins
DO $$ BEGIN
  CREATE TYPE public.admin_role AS ENUM ('ADMIN', 'SUPER_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role public.admin_role NOT NULL DEFAULT 'ADMIN',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admins TO authenticated;
GRANT ALL ON public.admins TO service_role;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.admins WHERE user_id = _uid AND is_active = true);
$$;
CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.admins WHERE user_id = _uid AND is_active = true AND role = 'SUPER_ADMIN');
$$;

DROP POLICY IF EXISTS "admins self read" ON public.admins;
CREATE POLICY "admins self read" ON public.admins FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "super manage admins" ON public.admins;
CREATE POLICY "super manage admins" ON public.admins FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 4. admin_audit_logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit read admins" ON public.admin_audit_logs;
CREATE POLICY "audit read admins" ON public.admin_audit_logs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "audit insert admins" ON public.admin_audit_logs;
CREATE POLICY "audit insert admins" ON public.admin_audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND admin_id IN (SELECT id FROM public.admins WHERE user_id = auth.uid()));

-- 5. admin_freight_cancellations
DO $$ BEGIN
  CREATE TYPE public.refund_type AS ENUM ('FULL','PARTIAL','NONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.admin_freight_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id uuid NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES public.admins(id),
  reason text NOT NULL,
  refund_type public.refund_type NOT NULL DEFAULT 'NONE',
  refund_amount_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_freight_cancellations TO authenticated;
GRANT ALL ON public.admin_freight_cancellations TO service_role;
ALTER TABLE public.admin_freight_cancellations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "afc read admins" ON public.admin_freight_cancellations;
CREATE POLICY "afc read admins" ON public.admin_freight_cancellations FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "afc insert admins" ON public.admin_freight_cancellations;
CREATE POLICY "afc insert admins" ON public.admin_freight_cancellations FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- 6. Broad admin SELECT and UPDATE policies on existing tables
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['contractors','providers','vehicles','freights','candidacies','jobs','payments','feedbacks','check_ins','check_outs','user_roles']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "admin read all" ON public.%I;', t);
    EXECUTE format('CREATE POLICY "admin read all" ON public.%I FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));', t);
    EXECUTE format('DROP POLICY IF EXISTS "admin update all" ON public.%I;', t);
    EXECUTE format('CREATE POLICY "admin update all" ON public.%I FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));', t);
    EXECUTE format('DROP POLICY IF EXISTS "admin delete all" ON public.%I;', t);
    EXECUTE format('CREATE POLICY "admin delete all" ON public.%I FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));', t);
  END LOOP;
END $$;

-- 7. updated_at triggers on new tables
DROP TRIGGER IF EXISTS admins_set_updated_at ON public.admins;
CREATE TRIGGER admins_set_updated_at BEFORE UPDATE ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
