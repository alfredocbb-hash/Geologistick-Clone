
# Fix: Chofer no puede ver sellers al escanear paquetes ML

## Problema
Cuando el chofer (kevinbernard@beraexpress.com) escanea un paquete ML Flex, el sistema busca el seller por `store_id` en la tabla `ecommerce_sellers`. Sin embargo, la politica de seguridad (RLS) solo permite leer esa tabla a roles admin, supervisor y operador. El chofer no tiene permiso, asi que la consulta retorna vacio y el dialogo muestra "Seller no registrado" aunque el seller SI existe.

## Solucion

### Cambio en base de datos: Agregar permiso de lectura para choferes

Modificar la politica RLS de SELECT en `ecommerce_sellers` para incluir el rol `chofer`. Esto es necesario porque los choferes usan el flujo de escaneo ML que necesita verificar si un seller esta registrado antes de poder registrar el envio.

La politica actual permite:
- admin, supervisor, operador (del mismo tenant)
- El propio seller (user_id = auth.uid())
- Super admin

Se agregara:
- chofer (del mismo tenant) -- solo lectura

### SQL de migracion
```sql
DROP POLICY IF EXISTS "Ver sellers de su tenant" ON ecommerce_sellers;

CREATE POLICY "Ver sellers de su tenant" ON ecommerce_sellers
FOR SELECT USING (
  (
    (tenant_id = current_user_tenant()) 
    AND (
      is_admin(auth.uid()) 
      OR has_role(auth.uid(), 'supervisor'::app_role) 
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'chofer'::app_role)
    )
  ) 
  OR (user_id = auth.uid()) 
  OR is_super_admin(auth.uid())
);
```

No se requieren cambios de codigo -- el `MLRegisterDialog` ya hace la consulta correctamente, solo necesita que RLS permita al chofer leer.
