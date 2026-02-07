
CREATE OR REPLACE FUNCTION public.log_envio_estado_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_notas TEXT;
  v_ubicacion TEXT;
  v_suc_origen_nombre TEXT;
  v_suc_destino_nombre TEXT;
  v_suc_entrega_nombre TEXT;
  v_suc_actual_nombre TEXT;
  v_suc_actual_es_centro BOOLEAN;
  v_chofer_nombre TEXT;
  v_usuario_nombre TEXT;
  v_user_sucursal_id UUID;
  v_is_destino_final BOOLEAN := false;
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    -- Obtener nombres de sucursales del envío
    SELECT nombre INTO v_suc_origen_nombre 
    FROM sucursales WHERE id = NEW.sucursal_origen_id;
    
    SELECT nombre INTO v_suc_destino_nombre 
    FROM sucursales WHERE id = NEW.sucursal_destino_id;
    
    SELECT nombre INTO v_suc_entrega_nombre 
    FROM sucursales WHERE id = NEW.sucursal_entrega_id;
    
    -- Obtener nombre del chofer asignado
    IF NEW.chofer_id IS NOT NULL THEN
      v_chofer_nombre := public.get_user_display_name(NEW.chofer_id);
    END IF;
    
    -- Obtener sucursal del usuario que realiza la acción
    SELECT sucursal_id INTO v_user_sucursal_id 
    FROM profiles WHERE user_id = auth.uid();
    
    IF v_user_sucursal_id IS NOT NULL THEN
      SELECT nombre, es_centro_logistico 
      INTO v_suc_actual_nombre, v_suc_actual_es_centro
      FROM sucursales WHERE id = v_user_sucursal_id;
      
      -- Verificar si es la sucursal destino final
      v_is_destino_final := (v_user_sucursal_id = NEW.sucursal_destino_id);
    END IF;
    
    -- Nombre del usuario actual
    v_usuario_nombre := public.get_user_display_name(auth.uid());
    
    -- Generar notas descriptivas según transición de estado
    v_notas := CASE
      -- Creación inicial (pendiente)
      WHEN NEW.estado = 'pendiente' AND OLD.estado IS NULL THEN
        'Sucursal Origen ' || COALESCE(v_suc_origen_nombre, '')
      
      -- Recogido (pickup realizado) - contextual según estado anterior
      WHEN NEW.estado = 'recogido' THEN
        CASE
          WHEN OLD.estado = 'en_sucursal' THEN
            'Recogido en Sucursal ' || COALESCE(v_suc_actual_nombre, v_suc_origen_nombre, '') ||
            CASE WHEN v_usuario_nombre IS NOT NULL AND v_usuario_nombre != '' 
                 THEN ' por ' || v_usuario_nombre ELSE '' END
          ELSE
            'Paquete recogido del remitente' ||
            CASE WHEN v_usuario_nombre IS NOT NULL AND v_usuario_nombre != '' 
                 THEN ' por ' || v_usuario_nombre ELSE '' END
        END
      
      -- En tránsito (recolección para transporte entre sucursales)
      WHEN NEW.estado = 'en_transito' THEN
        'Camino hacia ' || COALESCE(v_suc_destino_nombre, 'destino') || 
        CASE WHEN v_chofer_nombre IS NOT NULL AND v_chofer_nombre != '' 
             THEN ' - Recolectado por ' || v_chofer_nombre ELSE '' END
      
      -- Ingreso a sucursal
      WHEN NEW.estado = 'en_sucursal' THEN
        CASE
          WHEN v_suc_actual_es_centro = true THEN
            'Ingreso a Centro Logístico ' || COALESCE(v_suc_actual_nombre, '')
          WHEN v_is_destino_final THEN
            'Ingreso a Sucursal Destino ' || COALESCE(v_suc_actual_nombre, '') || ' - Listo para retirar'
          ELSE
            'Ingreso a Sucursal ' || COALESCE(v_suc_actual_nombre, '')
        END
      
      -- En reparto (última milla)
      WHEN NEW.estado = 'en_reparto' THEN
        'En reparto' || 
        CASE WHEN v_chofer_nombre IS NOT NULL AND v_chofer_nombre != '' 
             THEN ' - Repartidor: ' || v_chofer_nombre ELSE '' END
      
      -- Entregado
      WHEN NEW.estado = 'entregado' THEN
        CASE
          WHEN NEW.entregado_en_sucursal = true THEN
            'Entregado en Sucursal ' || COALESCE(v_suc_entrega_nombre, v_suc_actual_nombre, v_suc_destino_nombre, '')
          ELSE
            'Entregado en domicilio' || 
            CASE WHEN v_usuario_nombre IS NOT NULL AND v_usuario_nombre != '' 
                 THEN ' - Entregó: ' || v_usuario_nombre ELSE '' END
        END
      
      -- Devuelto
      WHEN NEW.estado = 'devuelto' THEN
        'Devuelto a Sucursal Origen ' || COALESCE(v_suc_origen_nombre, '')
      
      -- Cancelado
      WHEN NEW.estado = 'cancelado' THEN
        'Envío cancelado'
      
      -- Incidencia
      WHEN NEW.estado = 'incidencia' THEN
        'Incidencia reportada'
      
      ELSE NULL
    END;
    
    -- Ubicación = sucursal actual del usuario que realiza la acción
    v_ubicacion := v_suc_actual_nombre;
    
    INSERT INTO envio_historial (envio_id, estado_anterior, estado_nuevo, notas, ubicacion, created_by)
    VALUES (NEW.id, OLD.estado, NEW.estado, v_notas, v_ubicacion, auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;
