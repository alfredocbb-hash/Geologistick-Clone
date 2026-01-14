-- Fix overly permissive RLS policies for facturas table
DROP POLICY IF EXISTS "Allow authenticated users to insert facturas" ON public.facturas;
DROP POLICY IF EXISTS "Allow authenticated users to update facturas" ON public.facturas;

-- Proper INSERT policy: only admins, operadores, or users from the shipment's origin branch
CREATE POLICY "Insert facturas por rol"
  ON public.facturas FOR INSERT TO authenticated 
  WITH CHECK (
    is_admin(auth.uid()) 
    OR has_role(auth.uid(), 'operador'::app_role) 
    OR has_role(auth.uid(), 'atencion_cliente'::app_role)
    OR (EXISTS (
      SELECT 1 FROM envios e
      WHERE e.id = facturas.envio_id 
      AND e.sucursal_origen_id = get_user_sucursal(auth.uid())
    ))
  );

-- Proper UPDATE policy: only admins or supervisors
CREATE POLICY "Update facturas por admin"
  ON public.facturas FOR UPDATE TO authenticated 
  USING (
    is_admin(auth.uid()) 
    OR has_role(auth.uid(), 'supervisor'::app_role)
  );