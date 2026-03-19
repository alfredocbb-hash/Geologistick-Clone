
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-assets', 'marketing-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for marketing assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'marketing-assets');

CREATE POLICY "Authenticated users can upload marketing assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'marketing-assets');

CREATE POLICY "Authenticated users can delete marketing assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'marketing-assets');
