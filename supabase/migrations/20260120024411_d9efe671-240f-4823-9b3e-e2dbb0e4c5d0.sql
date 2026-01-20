-- Actualizar política RLS de INSERT en clientes para incluir más roles
DROP POLICY IF EXISTS "Crear clientes en su tenant" ON public.clientes;

CREATE POLICY "Crear clientes en su tenant" ON public.clientes 
FOR INSERT TO authenticated 
WITH CHECK (
  (tenant_id = current_user_tenant()) 
  AND (
    is_admin(auth.uid()) 
    OR has_role(auth.uid(), 'operador')
    OR has_role(auth.uid(), 'atencion_cliente')
    OR has_role(auth.uid(), 'sucursal')
    OR has_role(auth.uid(), 'despachador')
    OR has_role(auth.uid(), 'supervisor')
    OR (sucursal_id = get_user_sucursal(auth.uid()))
  )
);