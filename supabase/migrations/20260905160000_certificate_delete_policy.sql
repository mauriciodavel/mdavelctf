DROP POLICY IF EXISTS certificates_delete_authorized ON public.certificates;
CREATE POLICY certificates_delete_authorized ON public.certificates FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (
        p.role IN ('super_admin', 'admin') OR
        (p.role = 'instructor' AND EXISTS (
          SELECT 1 FROM public.events e WHERE e.id = certificates.event_id AND e.created_by = auth.uid()
        ))
      )
    )
  );
