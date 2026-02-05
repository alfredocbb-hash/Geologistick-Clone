-- Agregar política RLS pública para permitir ver logos en la landing page
CREATE POLICY "Acceso público a logos para landing"
ON tenant_branding
FOR SELECT
USING (
  logo_light IS NOT NULL OR logo_dark IS NOT NULL
);