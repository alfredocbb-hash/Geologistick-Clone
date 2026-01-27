-- Make delivery-photos bucket public so images can be loaded in EPOD
UPDATE storage.buckets 
SET public = true 
WHERE name = 'delivery-photos';