-- Drop existing policy
DROP POLICY IF EXISTS "Insertar historial" ON public.envio_historial;

-- Create expanded policy for envio_historial INSERT
CREATE POLICY "Insertar historial" ON public.envio_historial
FOR INSERT TO authenticated
WITH CHECK (
  -- Admins siempre pueden
  is_admin(auth.uid()) 
  
  -- Chofer asignado al envío (cualquier tipo de asignación)
  OR (
    has_role(auth.uid(), 'chofer'::app_role) 
    AND EXISTS (
      SELECT 1 FROM envios e 
      WHERE e.id = envio_historial.envio_id 
      AND (
        e.chofer_id = auth.uid()
        OR e.chofer_ultima_milla_id = auth.uid()
      )
    )
  )
  
  -- Chofer en ruta planificada con este envío
  OR (
    has_role(auth.uid(), 'chofer'::app_role)
    AND EXISTS (
      SELECT 1 FROM ruta_paradas rp
      JOIN rutas_planificadas r ON r.id = rp.ruta_id
      WHERE rp.envio_id = envio_historial.envio_id
      AND r.chofer_id = auth.uid()
      AND r.estado IN ('planificada', 'en_curso')
    )
  )
  
  -- Chofer en hoja de ruta con este envío
  OR (
    has_role(auth.uid(), 'chofer'::app_role)
    AND EXISTS (
      SELECT 1 FROM hoja_ruta_envios hre
      JOIN hojas_ruta hr ON hr.id = hre.hoja_ruta_id
      WHERE hre.envio_id = envio_historial.envio_id
      AND hr.chofer_id = auth.uid()
      AND hr.estado IN ('pendiente', 'en_transito')
    )
  )
  
  -- Roles operativos pueden registrar historial
  OR has_role(auth.uid(), 'operador'::app_role)
  OR has_role(auth.uid(), 'bodega'::app_role)
  OR has_role(auth.uid(), 'sucursal'::app_role)
);