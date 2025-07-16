-- Add RLS policy to allow public access to shared shipping analyses
CREATE POLICY "Public can view shared analyses" 
ON public.shipping_analyses 
FOR SELECT 
TO public
USING (
  EXISTS (
    SELECT 1 
    FROM public.report_shares 
    WHERE report_shares.analysis_id = shipping_analyses.id 
    AND report_shares.is_active = true 
    AND (report_shares.expires_at IS NULL OR report_shares.expires_at > now())
  )
);