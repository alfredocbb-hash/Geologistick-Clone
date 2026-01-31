-- Add missing created_by column to tenant_api_keys table
ALTER TABLE public.tenant_api_keys 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);