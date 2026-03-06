-- Fix Beraexpress SMTP: correct from_email domain and move to production
UPDATE public.system_integrations
SET config_value = 'Notificacion@beraexpress.com'
WHERE id = '7b376639-39e0-4f5f-80e1-28d893b49d07'
  AND config_key = 'from_email';

UPDATE public.system_integrations
SET environment = 'production'
WHERE tenant_id = '94a9ea85-43c5-49ac-9bfa-86843072c2ce'
  AND integration_type = 'email_smtp';