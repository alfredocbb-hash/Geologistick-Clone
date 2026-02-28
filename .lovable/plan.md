

# Fix: RLS en sucursal_zonas + Tarifas sucursal-a-sucursal

## Problema 1: Error RLS al agregar zonas de cobertura

La politica RLS de `sucursal_zonas` para INSERT/UPDATE/DELETE requiere `is_admin(auth.uid())` y `tenant_id = current_user_tenant()`, pero **no incluye super admins**. Esto causa que:
- Super admins (que no tienen tenant_id) no puedan gestionar zonas
- Cualquier usuario no-admin reciba "new row violates row-level security policy"

**Solucion**: Actualizar la politica "Admins manage coverage zones for their tenant" para agregar `OR is_super_admin(auth.uid())`, siguiendo el patron usado en todas las demas tablas del sistema.

## Problema 2: No aparecen tarifas en envios sucursal-a-sucursal

La correccion de datos (asignar tarifa a Rosario en `sucursal_tarifas`) no se ejecuto en la implementacion anterior - solo se modifico el codigo bidireccional. Falta insertar el registro en la base de datos.

**Solucion**: Crear una migracion que inserte el registro faltante en `sucursal_tarifas` para la sucursal Rosario con la tarifa correspondiente de BlackBox.

## Cambios tecnicos

### 1. Migracion SQL

Una sola migracion con:

```sql
-- Fix 1: RLS sucursal_zonas - agregar soporte super admin
DROP POLICY IF EXISTS "Admins manage coverage zones for their tenant" ON public.sucursal_zonas;
CREATE POLICY "Admins manage coverage zones for their tenant"
  ON public.sucursal_zonas FOR ALL TO authenticated
  USING (
    (sucursal_id IN (SELECT id FROM sucursales WHERE tenant_id = current_user_tenant())
     AND is_admin(auth.uid()))
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    (sucursal_id IN (SELECT id FROM sucursales WHERE tenant_id = current_user_tenant())
     AND is_admin(auth.uid()))
    OR is_super_admin(auth.uid())
  );

-- Fix 2: Asignar tarifa a Rosario (BlackBox)
INSERT INTO public.sucursal_tarifas (sucursal_id, tarifa_id, habilitada, tenant_id)
VALUES (
  '89334282-6670-41f2-bdf9-a9cf1518a64c',
  '10e24a96-c522-4df1-88ed-0c042050df41',
  true,
  '81be07a7-73a0-4986-994e-5365478343eb'
)
ON CONFLICT (sucursal_id, tarifa_id) DO UPDATE SET habilitada = true;
```

### 2. Sin cambios de codigo frontend

El codigo bidireccional ya implementado en `NewShipment.tsx` es correcto. Solo faltaba la data.

## Impacto

- Super admins podran gestionar zonas de cobertura de cualquier sucursal
- Admins de tenant siguen gestionando solo sus propias sucursales
- BlackBox: Rosario podra ver y usar la tarifa para Mar del Plata

