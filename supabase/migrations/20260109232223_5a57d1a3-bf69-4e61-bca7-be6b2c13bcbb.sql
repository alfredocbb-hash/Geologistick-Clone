-- =============================================
-- FASE 1: INFRAESTRUCTURA BASE - SISTEMA LOGÍSTICO
-- =============================================

-- 1. Crear enum para roles de la aplicación
CREATE TYPE public.app_role AS ENUM (
  'admin',
  'chofer',
  'operador',
  'sucursal',
  'cliente',
  'supervisor',
  'bodega',
  'atencion_cliente',
  'despachador'
);

-- 2. Crear enum para estados de envío
CREATE TYPE public.shipment_status AS ENUM (
  'pendiente',
  'recogido',
  'en_bodega',
  'en_transito',
  'en_reparto',
  'entregado',
  'devuelto',
  'cancelado'
);

-- 3. Crear enum para estados de sesión de caja
CREATE TYPE public.cash_session_status AS ENUM (
  'abierta',
  'cerrada',
  'pendiente_aprobacion'
);

-- 4. Crear enum para estados de liquidación
CREATE TYPE public.settlement_status AS ENUM (
  'generada',
  'enviada',
  'pagada',
  'rechazada'
);

-- 5. Crear enum para estados de pago
CREATE TYPE public.payment_status AS ENUM (
  'pendiente',
  'pagado',
  'fallido',
  'reembolsado'
);

-- 6. Crear enum para métodos de pago
CREATE TYPE public.payment_method AS ENUM (
  'efectivo',
  'mercado_pago',
  'transferencia'
);

-- =============================================
-- TABLAS PRINCIPALES
-- =============================================

-- 7. Tabla de sucursales
CREATE TABLE public.sucursales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  activa BOOLEAN DEFAULT true,
  horario_apertura TIME,
  horario_cierre TIME,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Tabla de perfiles de usuario
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  nombre TEXT NOT NULL,
  apellido TEXT,
  telefono TEXT,
  avatar_url TEXT,
  sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Tabla de roles de usuario (separada para seguridad)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 10. Tabla de clientes (remitentes y destinatarios)
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  apellido TEXT,
  email TEXT,
  telefono TEXT NOT NULL,
  direccion TEXT NOT NULL,
  ciudad TEXT,
  codigo_postal TEXT,
  notas TEXT,
  sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Tabla de tarifas
CREATE TABLE public.tarifas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  zona_origen TEXT,
  zona_destino TEXT,
  precio_base DECIMAL(10,2) NOT NULL,
  precio_por_kg DECIMAL(10,2) DEFAULT 0,
  precio_por_km DECIMAL(10,2) DEFAULT 0,
  comision_chofer_porcentaje DECIMAL(5,2) DEFAULT 0,
  comision_chofer_fija DECIMAL(10,2) DEFAULT 0,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Tabla de envíos
CREATE TABLE public.envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number TEXT NOT NULL UNIQUE,
  sucursal_origen_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  sucursal_destino_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  remitente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  destinatario_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  chofer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tarifa_id UUID REFERENCES public.tarifas(id) ON DELETE SET NULL,
  estado shipment_status DEFAULT 'pendiente',
  descripcion TEXT,
  peso_kg DECIMAL(10,2),
  dimensiones TEXT,
  valor_declarado DECIMAL(10,2),
  precio_total DECIMAL(10,2) NOT NULL,
  pago_contra_entrega BOOLEAN DEFAULT false,
  notas TEXT,
  fecha_recogida TIMESTAMPTZ,
  fecha_entrega TIMESTAMPTZ,
  firma_destinatario TEXT,
  foto_entrega TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 13. Tabla de historial de estados de envío
CREATE TABLE public.envio_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envio_id UUID REFERENCES public.envios(id) ON DELETE CASCADE NOT NULL,
  estado_anterior shipment_status,
  estado_nuevo shipment_status NOT NULL,
  notas TEXT,
  ubicacion TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. Tabla de sesiones de caja
CREATE TABLE public.sesiones_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE CASCADE NOT NULL,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  monto_inicial DECIMAL(10,2) NOT NULL,
  monto_final DECIMAL(10,2),
  monto_esperado DECIMAL(10,2),
  diferencia DECIMAL(10,2),
  estado cash_session_status DEFAULT 'abierta',
  notas_apertura TEXT,
  notas_cierre TEXT,
  aprobado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fecha_apertura TIMESTAMPTZ DEFAULT now(),
  fecha_cierre TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. Tabla de movimientos de caja
CREATE TABLE public.movimientos_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_caja_id UUID REFERENCES public.sesiones_caja(id) ON DELETE CASCADE NOT NULL,
  envio_id UUID REFERENCES public.envios(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  monto DECIMAL(10,2) NOT NULL,
  metodo_pago payment_method NOT NULL,
  concepto TEXT NOT NULL,
  referencia TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 16. Tabla de comisiones
CREATE TABLE public.comisiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chofer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  envio_id UUID REFERENCES public.envios(id) ON DELETE SET NULL,
  monto DECIMAL(10,2) NOT NULL,
  porcentaje_aplicado DECIMAL(5,2),
  monto_fijo_aplicado DECIMAL(10,2),
  liquidacion_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 17. Tabla de liquidaciones
CREATE TABLE public.liquidaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chofer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  monto_total DECIMAL(10,2) NOT NULL,
  cantidad_envios INTEGER DEFAULT 0,
  estado settlement_status DEFAULT 'generada',
  metodo_pago payment_method,
  referencia_pago TEXT,
  fecha_pago TIMESTAMPTZ,
  notas TEXT,
  generado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  aprobado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agregar FK de comisiones a liquidaciones
ALTER TABLE public.comisiones 
ADD CONSTRAINT fk_comisiones_liquidacion 
FOREIGN KEY (liquidacion_id) REFERENCES public.liquidaciones(id) ON DELETE SET NULL;

-- 18. Tabla de pagos
CREATE TABLE public.pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envio_id UUID REFERENCES public.envios(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  monto DECIMAL(10,2) NOT NULL,
  metodo payment_method NOT NULL,
  estado payment_status DEFAULT 'pendiente',
  mercado_pago_id TEXT,
  mercado_pago_status TEXT,
  referencia TEXT,
  notas TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- FUNCIONES DE SEGURIDAD
-- =============================================

-- 19. Función para verificar rol (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
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
      AND role = _role
  )
$$;

-- 20. Función para verificar si es admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- 21. Función para obtener sucursal del usuario
CREATE OR REPLACE FUNCTION public.get_user_sucursal(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sucursal_id
  FROM public.profiles
  WHERE user_id = _user_id
$$;

-- 22. Función para verificar acceso a sucursal (admin ve todo, otros solo su sucursal)
CREATE OR REPLACE FUNCTION public.can_access_sucursal(_user_id UUID, _sucursal_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_admin(_user_id) 
    OR public.get_user_sucursal(_user_id) = _sucursal_id
    OR public.has_role(_user_id, 'supervisor')
$$;

-- 23. Función para generar tracking number
CREATE OR REPLACE FUNCTION public.generate_tracking_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_tracking TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    new_tracking := 'ENV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 6));
    SELECT EXISTS(SELECT 1 FROM public.envios WHERE tracking_number = new_tracking) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN new_tracking;
END;
$$;

-- 24. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a tablas con updated_at
CREATE TRIGGER update_sucursales_updated_at BEFORE UPDATE ON public.sucursales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tarifas_updated_at BEFORE UPDATE ON public.tarifas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_envios_updated_at BEFORE UPDATE ON public.envios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_liquidaciones_updated_at BEFORE UPDATE ON public.liquidaciones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pagos_updated_at BEFORE UPDATE ON public.pagos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 25. Trigger para registrar historial de envío
CREATE OR REPLACE FUNCTION public.log_envio_estado_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO public.envio_historial (envio_id, estado_anterior, estado_nuevo, created_by)
    VALUES (NEW.id, OLD.estado, NEW.estado, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_envio_estado AFTER UPDATE ON public.envios FOR EACH ROW EXECUTE FUNCTION public.log_envio_estado_change();

-- 26. Trigger para crear perfil automáticamente al registrar usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, nombre)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nombre', SPLIT_PART(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarifas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envio_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comisiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

-- SUCURSALES: Todos autenticados pueden ver, solo admin modifica
CREATE POLICY "Usuarios autenticados pueden ver sucursales" ON public.sucursales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Solo admin puede insertar sucursales" ON public.sucursales FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Solo admin puede actualizar sucursales" ON public.sucursales FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Solo admin puede eliminar sucursales" ON public.sucursales FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- PROFILES: Usuario ve su perfil, admin ve todos
CREATE POLICY "Usuario puede ver su perfil" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Usuario puede actualizar su perfil" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Solo admin puede insertar perfiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) OR user_id = auth.uid());

-- USER_ROLES: Solo admin gestiona roles
CREATE POLICY "Usuario puede ver sus roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Solo admin puede asignar roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Solo admin puede eliminar roles" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- CLIENTES: Acceso híbrido por sucursal
CREATE POLICY "Ver clientes de su sucursal o admin" ON public.clientes FOR SELECT TO authenticated USING (
  public.is_admin(auth.uid()) 
  OR sucursal_id = public.get_user_sucursal(auth.uid())
  OR user_id = auth.uid()
);
CREATE POLICY "Crear clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Actualizar clientes de su sucursal" ON public.clientes FOR UPDATE TO authenticated USING (
  public.is_admin(auth.uid()) 
  OR sucursal_id = public.get_user_sucursal(auth.uid())
);

-- TARIFAS: Todos ven, solo admin modifica
CREATE POLICY "Todos pueden ver tarifas activas" ON public.tarifas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Solo admin puede gestionar tarifas" ON public.tarifas FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- ENVIOS: Acceso híbrido complejo
CREATE POLICY "Ver envíos según rol" ON public.envios FOR SELECT TO authenticated USING (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'supervisor')
  OR sucursal_origen_id = public.get_user_sucursal(auth.uid())
  OR sucursal_destino_id = public.get_user_sucursal(auth.uid())
  OR chofer_id = auth.uid()
  OR created_by = auth.uid()
);
CREATE POLICY "Crear envíos" ON public.envios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Actualizar envíos según rol" ON public.envios FOR UPDATE TO authenticated USING (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'supervisor')
  OR public.has_role(auth.uid(), 'operador')
  OR public.has_role(auth.uid(), 'despachador')
  OR chofer_id = auth.uid()
  OR sucursal_origen_id = public.get_user_sucursal(auth.uid())
);

-- ENVIO_HISTORIAL: Igual que envíos
CREATE POLICY "Ver historial de envíos" ON public.envio_historial FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.envios e WHERE e.id = envio_id AND (
      public.is_admin(auth.uid())
      OR e.sucursal_origen_id = public.get_user_sucursal(auth.uid())
      OR e.chofer_id = auth.uid()
    )
  )
);
CREATE POLICY "Insertar historial" ON public.envio_historial FOR INSERT TO authenticated WITH CHECK (true);

-- SESIONES_CAJA: Por sucursal
CREATE POLICY "Ver sesiones de caja de su sucursal" ON public.sesiones_caja FOR SELECT TO authenticated USING (
  public.is_admin(auth.uid())
  OR sucursal_id = public.get_user_sucursal(auth.uid())
  OR usuario_id = auth.uid()
);
CREATE POLICY "Crear sesión de caja" ON public.sesiones_caja FOR INSERT TO authenticated WITH CHECK (
  sucursal_id = public.get_user_sucursal(auth.uid()) OR public.is_admin(auth.uid())
);
CREATE POLICY "Actualizar sesión de caja" ON public.sesiones_caja FOR UPDATE TO authenticated USING (
  usuario_id = auth.uid() OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'supervisor')
);

-- MOVIMIENTOS_CAJA: Por sesión de caja
CREATE POLICY "Ver movimientos de caja" ON public.movimientos_caja FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.sesiones_caja sc WHERE sc.id = sesion_caja_id AND (
      public.is_admin(auth.uid())
      OR sc.sucursal_id = public.get_user_sucursal(auth.uid())
    )
  )
);
CREATE POLICY "Crear movimientos de caja" ON public.movimientos_caja FOR INSERT TO authenticated WITH CHECK (true);

-- COMISIONES: Chofer ve las suyas, admin ve todas
CREATE POLICY "Ver comisiones" ON public.comisiones FOR SELECT TO authenticated USING (
  chofer_id = auth.uid() OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'supervisor')
);
CREATE POLICY "Crear comisiones" ON public.comisiones FOR INSERT TO authenticated WITH CHECK (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'supervisor')
);

-- LIQUIDACIONES: Chofer ve las suyas, admin ve todas
CREATE POLICY "Ver liquidaciones" ON public.liquidaciones FOR SELECT TO authenticated USING (
  chofer_id = auth.uid() OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'supervisor')
);
CREATE POLICY "Crear liquidaciones" ON public.liquidaciones FOR INSERT TO authenticated WITH CHECK (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'supervisor')
);
CREATE POLICY "Actualizar liquidaciones" ON public.liquidaciones FOR UPDATE TO authenticated USING (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'supervisor')
);

-- PAGOS: Por envío/sucursal
CREATE POLICY "Ver pagos" ON public.pagos FOR SELECT TO authenticated USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.envios e WHERE e.id = envio_id AND (
      e.sucursal_origen_id = public.get_user_sucursal(auth.uid())
      OR e.created_by = auth.uid()
    )
  )
);
CREATE POLICY "Crear pagos" ON public.pagos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Actualizar pagos" ON public.pagos FOR UPDATE TO authenticated USING (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'supervisor')
);

-- =============================================
-- ÍNDICES PARA RENDIMIENTO
-- =============================================

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_sucursal_id ON public.profiles(sucursal_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_clientes_sucursal_id ON public.clientes(sucursal_id);
CREATE INDEX idx_clientes_telefono ON public.clientes(telefono);
CREATE INDEX idx_envios_tracking ON public.envios(tracking_number);
CREATE INDEX idx_envios_estado ON public.envios(estado);
CREATE INDEX idx_envios_sucursal_origen ON public.envios(sucursal_origen_id);
CREATE INDEX idx_envios_sucursal_destino ON public.envios(sucursal_destino_id);
CREATE INDEX idx_envios_chofer ON public.envios(chofer_id);
CREATE INDEX idx_envios_created_at ON public.envios(created_at);
CREATE INDEX idx_sesiones_caja_sucursal ON public.sesiones_caja(sucursal_id);
CREATE INDEX idx_sesiones_caja_estado ON public.sesiones_caja(estado);
CREATE INDEX idx_comisiones_chofer ON public.comisiones(chofer_id);
CREATE INDEX idx_liquidaciones_chofer ON public.liquidaciones(chofer_id);
CREATE INDEX idx_pagos_estado ON public.pagos(estado);