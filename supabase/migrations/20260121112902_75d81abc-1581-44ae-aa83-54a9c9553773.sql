-- Add DELETE policy for liquidaciones table (driver settlements)
-- Only admin and supervisor can delete settlements that are not paid
CREATE POLICY "Eliminar liquidaciones no pagadas"
ON public.liquidaciones
FOR DELETE
USING (
  (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role))
  AND estado != 'pagada'
  AND tenant_id = current_user_tenant()
);

-- Add UPDATE policy for comisiones to allow unlinking from settlements
CREATE POLICY "Actualizar comisiones para desvincular liquidacion"
ON public.comisiones
FOR UPDATE
USING (
  is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role)
)
WITH CHECK (
  is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role)
);

-- Add DELETE policy for liquidacion_sucursal_detalles
CREATE POLICY "Eliminar detalles de liquidación sucursal"
ON public.liquidacion_sucursal_detalles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM liquidaciones_sucursal ls
    WHERE ls.id = liquidacion_sucursal_detalles.liquidacion_id
    AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role))
    AND ls.estado != 'pagada'
  )
);

-- Add DELETE policy for liquidaciones_sucursal (branch settlements)
CREATE POLICY "Eliminar liquidaciones sucursal no pagadas"
ON public.liquidaciones_sucursal
FOR DELETE
USING (
  (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role))
  AND estado != 'pagada'
  AND tenant_id = current_user_tenant()
);