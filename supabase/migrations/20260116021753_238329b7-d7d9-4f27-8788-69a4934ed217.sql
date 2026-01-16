-- Add contact and social media fields to tenant_branding
ALTER TABLE public.tenant_branding
ADD COLUMN IF NOT EXISTS company_address text,
ADD COLUMN IF NOT EXISTS company_city varchar(100),
ADD COLUMN IF NOT EXISTS company_country varchar(100),
ADD COLUMN IF NOT EXISTS company_description text,
ADD COLUMN IF NOT EXISTS social_twitter varchar(255),
ADD COLUMN IF NOT EXISTS social_linkedin varchar(255),
ADD COLUMN IF NOT EXISTS social_instagram varchar(255),
ADD COLUMN IF NOT EXISTS social_facebook varchar(255),
ADD COLUMN IF NOT EXISTS social_whatsapp varchar(50);