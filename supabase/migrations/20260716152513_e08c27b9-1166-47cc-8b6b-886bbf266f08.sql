
CREATE POLICY "driver docs: owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'driver-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "driver docs: owner select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'driver-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "driver docs: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'driver-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "driver docs: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'driver-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "driver docs: admin select all"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'driver-documents'
    AND EXISTS (
      SELECT 1 FROM public.admins a
      WHERE a.user_id = auth.uid() AND a.is_active = true
    )
  );
