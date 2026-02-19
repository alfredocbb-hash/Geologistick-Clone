
-- Fix Bug 2: Ampliar política INSERT de cliente_cuenta_corriente basada en tenant en lugar de roles específicos
DROP POLICY IF EXISTS "Crear movimiento cuenta corriente" ON public.cliente_cuenta_corriente;

CREATE POLICY "Crear movimiento cuenta corriente" ON public.cliente_cuenta_corriente
FOR INSERT WITH CHECK (
  -- El cliente debe pertenecer al mismo tenant que el usuario autenticado
  -- Permite cualquier rol del tenant, no solo admin/supervisor
  EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = cliente_cuenta_corriente.cliente_id
      AND c.tenant_id = public.current_user_tenant()
  )
);
