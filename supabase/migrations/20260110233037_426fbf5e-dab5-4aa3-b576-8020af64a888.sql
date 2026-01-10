-- Create role_permissions table to document and manage permissions per role
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission_key TEXT NOT NULL,
  permission_name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (role, permission_key)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Only super_admin and admin can view permissions
CREATE POLICY "Admins can view permissions"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Only super_admin can modify permissions
CREATE POLICY "Super admins can manage permissions"
ON public.role_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Update is_admin function to include super_admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'super_admin')
  )
$$;

-- Create is_super_admin function
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  )
$$;

-- Insert default permissions for all roles
INSERT INTO public.role_permissions (role, permission_key, permission_name, description, enabled) VALUES
-- Super Admin - Full access
('super_admin', 'system.full_access', 'Acceso Total al Sistema', 'Control completo de todas las funciones', true),
('super_admin', 'users.manage_super_admin', 'Gestionar Super Admins', 'Asignar y revocar rol super_admin', true),
('super_admin', 'roles.manage', 'Gestionar Permisos de Roles', 'Modificar permisos de cada rol', true),

-- Admin
('admin', 'dashboard.view', 'Ver Dashboard', 'Acceso al panel de control principal', true),
('admin', 'users.manage', 'Gestionar Usuarios', 'Crear, editar y desactivar usuarios', true),
('admin', 'users.assign_roles', 'Asignar Roles', 'Asignar roles a usuarios (excepto super_admin)', true),
('admin', 'branches.manage', 'Gestionar Sucursales', 'Administrar sucursales del sistema', true),
('admin', 'rates.manage', 'Gestionar Tarifas', 'Configurar precios y tarifas', true),
('admin', 'vehicles.manage', 'Gestionar Vehículos', 'Administrar flota de vehículos', true),
('admin', 'drivers.manage', 'Gestionar Choferes', 'Administrar choferes y comisiones', true),
('admin', 'settlements.manage', 'Gestionar Liquidaciones', 'Ver y aprobar liquidaciones', true),
('admin', 'reports.full', 'Reportes Completos', 'Acceso a todos los reportes', true),

-- Supervisor
('supervisor', 'dashboard.view', 'Ver Dashboard', 'Acceso al panel de control', true),
('supervisor', 'shipments.view_all', 'Ver Todos los Envíos', 'Ver envíos de todas las sucursales', true),
('supervisor', 'routes.manage', 'Gestionar Rutas', 'Planificar y modificar rutas', true),
('supervisor', 'route_sheets.manage', 'Gestionar Hojas de Ruta', 'Crear y editar hojas de ruta', true),
('supervisor', 'settlements.view', 'Ver Liquidaciones', 'Visualizar liquidaciones', true),
('supervisor', 'live_map.view', 'Ver Mapa en Vivo', 'Monitorear choferes en tiempo real', true),

-- Operador
('operador', 'dashboard.view', 'Ver Dashboard', 'Acceso al panel de control', true),
('operador', 'shipments.create', 'Crear Envíos', 'Registrar nuevos envíos', true),
('operador', 'shipments.edit', 'Editar Envíos', 'Modificar datos de envíos', true),
('operador', 'clients.manage', 'Gestionar Clientes', 'Administrar base de clientes', true),
('operador', 'cash.manage', 'Manejar Caja', 'Abrir/cerrar caja y registrar movimientos', true),
('operador', 'tracking.view', 'Ver Tracking', 'Consultar estado de envíos', true),

-- Despachador
('despachador', 'route_sheets.create', 'Crear Hojas de Ruta', 'Generar hojas de ruta', true),
('despachador', 'route_sheets.dispatch', 'Despachar Hojas', 'Enviar hojas de ruta a choferes', true),
('despachador', 'shipments.scan', 'Escanear Envíos', 'Escanear QR de envíos', true),
('despachador', 'shipments.receive', 'Recibir Envíos', 'Registrar recepción de envíos', true),

-- Chofer
('chofer', 'my_routes.view', 'Ver Mis Rutas', 'Ver rutas asignadas', true),
('chofer', 'route.start', 'Iniciar Ruta', 'Comenzar una ruta de entrega', true),
('chofer', 'delivery.confirm', 'Confirmar Entregas', 'Registrar entregas con foto/firma', true),
('chofer', 'pickup.confirm', 'Confirmar Retiros', 'Registrar retiros de paquetes', true),
('chofer', 'incidents.report', 'Reportar Incidentes', 'Registrar problemas en entregas', true),
('chofer', 'commissions.view', 'Ver Comisiones', 'Consultar comisiones ganadas', true),

-- Bodega
('bodega', 'shipments.receive', 'Recibir Envíos', 'Registrar entrada de envíos', true),
('bodega', 'shipments.scan', 'Escanear Envíos', 'Escanear QR para tracking', true),
('bodega', 'inventory.view', 'Ver Inventario', 'Consultar envíos en bodega', true),
('bodega', 'transfers.manage', 'Gestionar Transferencias', 'Despachar envíos entre sucursales', true),

-- Sucursal
('sucursal', 'shipments.create', 'Crear Envíos', 'Registrar envíos de la sucursal', true),
('sucursal', 'shipments.view_branch', 'Ver Envíos Sucursal', 'Ver envíos de su sucursal', true),
('sucursal', 'cash.manage', 'Manejar Caja', 'Gestionar caja de la sucursal', true),
('sucursal', 'clients.view', 'Ver Clientes', 'Consultar clientes', true),

-- Atención al Cliente
('atencion_cliente', 'clients.manage', 'Gestionar Clientes', 'Atender consultas de clientes', true),
('atencion_cliente', 'tracking.view', 'Ver Tracking', 'Consultar estado de envíos', true),
('atencion_cliente', 'shipments.view', 'Ver Envíos', 'Consultar detalles de envíos', true),
('atencion_cliente', 'incidents.view', 'Ver Incidentes', 'Consultar reportes de incidentes', true),

-- Cliente
('cliente', 'my_shipments.view', 'Ver Mis Envíos', 'Consultar sus propios envíos', true),
('cliente', 'tracking.public', 'Tracking Público', 'Rastrear envíos con número', true),
('cliente', 'shipments.request', 'Solicitar Envío', 'Crear solicitudes de envío', true);