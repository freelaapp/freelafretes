CREATE POLICY "self insert own non-admin role"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND role IN ('contractor','provider'));