
-- Insert reports.view permission for admin role
INSERT INTO public.role_permissions (role, permission_key, permission_name, description, enabled)
VALUES ('admin', 'reports.view', 'Ver Reportes', 'Permite acceder al módulo de reportes y análisis', true)
ON CONFLICT DO NOTHING;
