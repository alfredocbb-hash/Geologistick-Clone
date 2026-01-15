-- Create branding storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can view branding files (public logos)
CREATE POLICY "Public can view branding files"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding');

-- Policy: Authenticated users can upload to their tenant folder
CREATE POLICY "Authenticated users can upload branding files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'branding' 
  AND auth.role() = 'authenticated'
);

-- Policy: Authenticated users can update their branding files
CREATE POLICY "Authenticated users can update branding files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'branding' 
  AND auth.role() = 'authenticated'
);

-- Policy: Authenticated users can delete their branding files
CREATE POLICY "Authenticated users can delete branding files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'branding' 
  AND auth.role() = 'authenticated'
);