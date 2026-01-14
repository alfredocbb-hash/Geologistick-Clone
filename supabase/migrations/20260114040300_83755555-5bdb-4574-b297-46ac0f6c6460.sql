-- Add invoicing permissions category
-- Insert permissions for all roles

-- Define invoicing permissions for each role
-- invoicing.view - Ver facturas
-- invoicing.create - Crear/emitir facturas
-- invoicing.manage - Gestionar configuración ARCA

-- Super Admin - All permissions enabled
INSERT INTO public.role_permissions (role, permission_key, permission_name, description, enabled)
VALUES 
  ('super_admin', 'invoicing.view', 'Ver Facturas', 'Permite visualizar el listado de facturas emitidas', true),
  ('super_admin', 'invoicing.create', 'Emitir Facturas', 'Permite emitir facturas electrónicas a clientes', true),
  ('super_admin', 'invoicing.manage', 'Configurar ARCA', 'Permite configurar la integración con AFIP/ARCA', true),
  ('super_admin', 'invoicing.pending', 'Facturas Pendientes', 'Permite ver y procesar facturas pendientes de emisión', true)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Admin - All invoicing permissions enabled
INSERT INTO public.role_permissions (role, permission_key, permission_name, description, enabled)
VALUES 
  ('admin', 'invoicing.view', 'Ver Facturas', 'Permite visualizar el listado de facturas emitidas', true),
  ('admin', 'invoicing.create', 'Emitir Facturas', 'Permite emitir facturas electrónicas a clientes', true),
  ('admin', 'invoicing.manage', 'Configurar ARCA', 'Permite configurar la integración con AFIP/ARCA', true),
  ('admin', 'invoicing.pending', 'Facturas Pendientes', 'Permite ver y procesar facturas pendientes de emisión', true)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Supervisor - Can view, create and see pending
INSERT INTO public.role_permissions (role, permission_key, permission_name, description, enabled)
VALUES 
  ('supervisor', 'invoicing.view', 'Ver Facturas', 'Permite visualizar el listado de facturas emitidas', true),
  ('supervisor', 'invoicing.create', 'Emitir Facturas', 'Permite emitir facturas electrónicas a clientes', true),
  ('supervisor', 'invoicing.manage', 'Configurar ARCA', 'Permite configurar la integración con AFIP/ARCA', false),
  ('supervisor', 'invoicing.pending', 'Facturas Pendientes', 'Permite ver y procesar facturas pendientes de emisión', true)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Operador - Can view and create invoices
INSERT INTO public.role_permissions (role, permission_key, permission_name, description, enabled)
VALUES 
  ('operador', 'invoicing.view', 'Ver Facturas', 'Permite visualizar el listado de facturas emitidas', true),
  ('operador', 'invoicing.create', 'Emitir Facturas', 'Permite emitir facturas electrónicas a clientes', true),
  ('operador', 'invoicing.manage', 'Configurar ARCA', 'Permite configurar la integración con AFIP/ARCA', false),
  ('operador', 'invoicing.pending', 'Facturas Pendientes', 'Permite ver y procesar facturas pendientes de emisión', false)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Despachador - Can view and create invoices (for branch delivery)
INSERT INTO public.role_permissions (role, permission_key, permission_name, description, enabled)
VALUES 
  ('despachador', 'invoicing.view', 'Ver Facturas', 'Permite visualizar el listado de facturas emitidas', true),
  ('despachador', 'invoicing.create', 'Emitir Facturas', 'Permite emitir facturas electrónicas a clientes', true),
  ('despachador', 'invoicing.manage', 'Configurar ARCA', 'Permite configurar la integración con AFIP/ARCA', false),
  ('despachador', 'invoicing.pending', 'Facturas Pendientes', 'Permite ver y procesar facturas pendientes de emisión', false)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Chofer - Can only create invoices during delivery
INSERT INTO public.role_permissions (role, permission_key, permission_name, description, enabled)
VALUES 
  ('chofer', 'invoicing.view', 'Ver Facturas', 'Permite visualizar el listado de facturas emitidas', false),
  ('chofer', 'invoicing.create', 'Emitir Facturas', 'Permite emitir facturas electrónicas a clientes', true),
  ('chofer', 'invoicing.manage', 'Configurar ARCA', 'Permite configurar la integración con AFIP/ARCA', false),
  ('chofer', 'invoicing.pending', 'Facturas Pendientes', 'Permite ver y procesar facturas pendientes de emisión', false)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Bodega - No invoicing permissions
INSERT INTO public.role_permissions (role, permission_key, permission_name, description, enabled)
VALUES 
  ('bodega', 'invoicing.view', 'Ver Facturas', 'Permite visualizar el listado de facturas emitidas', false),
  ('bodega', 'invoicing.create', 'Emitir Facturas', 'Permite emitir facturas electrónicas a clientes', false),
  ('bodega', 'invoicing.manage', 'Configurar ARCA', 'Permite configurar la integración con AFIP/ARCA', false),
  ('bodega', 'invoicing.pending', 'Facturas Pendientes', 'Permite ver y procesar facturas pendientes de emisión', false)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Sucursal - Can view and create invoices
INSERT INTO public.role_permissions (role, permission_key, permission_name, description, enabled)
VALUES 
  ('sucursal', 'invoicing.view', 'Ver Facturas', 'Permite visualizar el listado de facturas emitidas', true),
  ('sucursal', 'invoicing.create', 'Emitir Facturas', 'Permite emitir facturas electrónicas a clientes', true),
  ('sucursal', 'invoicing.manage', 'Configurar ARCA', 'Permite configurar la integración con AFIP/ARCA', false),
  ('sucursal', 'invoicing.pending', 'Facturas Pendientes', 'Permite ver y procesar facturas pendientes de emisión', false)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Atencion Cliente - Can view and create invoices
INSERT INTO public.role_permissions (role, permission_key, permission_name, description, enabled)
VALUES 
  ('atencion_cliente', 'invoicing.view', 'Ver Facturas', 'Permite visualizar el listado de facturas emitidas', true),
  ('atencion_cliente', 'invoicing.create', 'Emitir Facturas', 'Permite emitir facturas electrónicas a clientes', true),
  ('atencion_cliente', 'invoicing.manage', 'Configurar ARCA', 'Permite configurar la integración con AFIP/ARCA', false),
  ('atencion_cliente', 'invoicing.pending', 'Facturas Pendientes', 'Permite ver y procesar facturas pendientes de emisión', false)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Cliente - Can only view their own invoices
INSERT INTO public.role_permissions (role, permission_key, permission_name, description, enabled)
VALUES 
  ('cliente', 'invoicing.view', 'Ver Facturas', 'Permite visualizar el listado de facturas emitidas', true),
  ('cliente', 'invoicing.create', 'Emitir Facturas', 'Permite emitir facturas electrónicas a clientes', false),
  ('cliente', 'invoicing.manage', 'Configurar ARCA', 'Permite configurar la integración con AFIP/ARCA', false),
  ('cliente', 'invoicing.pending', 'Facturas Pendientes', 'Permite ver y procesar facturas pendientes de emisión', false)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Add unique constraint if not exists (for ON CONFLICT to work)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'role_permissions_role_permission_key_key'
  ) THEN
    ALTER TABLE public.role_permissions 
    ADD CONSTRAINT role_permissions_role_permission_key_key 
    UNIQUE (role, permission_key);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;