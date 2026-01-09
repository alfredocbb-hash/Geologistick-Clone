-- Corregir funciones sin search_path definido
CREATE OR REPLACE FUNCTION public.generate_tracking_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_envio_estado_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO public.envio_historial (envio_id, estado_anterior, estado_nuevo, created_by)
    VALUES (NEW.id, OLD.estado, NEW.estado, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, nombre)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nombre', SPLIT_PART(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

-- Corregir políticas RLS permisivas (WITH CHECK true)
-- CLIENTES: Restringir INSERT a usuarios autenticados con sucursal
DROP POLICY IF EXISTS "Crear clientes" ON public.clientes;
CREATE POLICY "Crear clientes" ON public.clientes FOR INSERT TO authenticated 
WITH CHECK (
  public.is_admin(auth.uid()) 
  OR public.has_role(auth.uid(), 'operador')
  OR public.has_role(auth.uid(), 'atencion_cliente')
  OR sucursal_id = public.get_user_sucursal(auth.uid())
);

-- ENVIOS: Restringir INSERT
DROP POLICY IF EXISTS "Crear envíos" ON public.envios;
CREATE POLICY "Crear envíos" ON public.envios FOR INSERT TO authenticated 
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'operador')
  OR public.has_role(auth.uid(), 'despachador')
  OR public.has_role(auth.uid(), 'atencion_cliente')
  OR sucursal_origen_id = public.get_user_sucursal(auth.uid())
);

-- ENVIO_HISTORIAL: Restringir INSERT a quienes pueden ver el envío
DROP POLICY IF EXISTS "Insertar historial" ON public.envio_historial;
CREATE POLICY "Insertar historial" ON public.envio_historial FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.envios e WHERE e.id = envio_id AND (
      public.is_admin(auth.uid())
      OR public.has_role(auth.uid(), 'operador')
      OR public.has_role(auth.uid(), 'despachador')
      OR e.chofer_id = auth.uid()
      OR e.sucursal_origen_id = public.get_user_sucursal(auth.uid())
    )
  )
);

-- MOVIMIENTOS_CAJA: Restringir INSERT
DROP POLICY IF EXISTS "Crear movimientos de caja" ON public.movimientos_caja;
CREATE POLICY "Crear movimientos de caja" ON public.movimientos_caja FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sesiones_caja sc WHERE sc.id = sesion_caja_id AND (
      public.is_admin(auth.uid())
      OR sc.usuario_id = auth.uid()
      OR sc.sucursal_id = public.get_user_sucursal(auth.uid())
    )
  )
);

-- PAGOS: Restringir INSERT
DROP POLICY IF EXISTS "Crear pagos" ON public.pagos;
CREATE POLICY "Crear pagos" ON public.pagos FOR INSERT TO authenticated 
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'operador')
  OR public.has_role(auth.uid(), 'atencion_cliente')
  OR EXISTS (
    SELECT 1 FROM public.envios e WHERE e.id = envio_id AND (
      e.sucursal_origen_id = public.get_user_sucursal(auth.uid())
      OR e.created_by = auth.uid()
    )
  )
);