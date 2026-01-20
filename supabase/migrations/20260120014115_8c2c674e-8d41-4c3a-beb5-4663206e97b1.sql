-- Drop the existing constraint that doesn't include tenant_id
ALTER TABLE public.system_integrations 
DROP CONSTRAINT IF EXISTS system_integrations_integration_type_config_key_environment_key;

-- Create new multi-tenant unique constraint
ALTER TABLE public.system_integrations
ADD CONSTRAINT system_integrations_tenant_type_key_env_unique 
UNIQUE (tenant_id, integration_type, config_key, environment);