-- Add integrations.manage permission for super_admin and admin roles
INSERT INTO public.role_permissions (role, permission_key, permission_name, description, enabled)
VALUES 
  ('super_admin', 'integrations.manage', 'Gestionar Integraciones', 'Configurar integraciones externas (Mercado Pago, Google Maps, etc.)', true),
  ('admin', 'integrations.manage', 'Gestionar Integraciones', 'Configurar integraciones externas (Mercado Pago, Google Maps, etc.)', true)
ON CONFLICT DO NOTHING;