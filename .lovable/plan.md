

# Fix: Error al guardar concepto con precio $0 en tarifa de otro tenant

## Problema

El trigger `validate_concepto_tenant` en la tabla `tarifa_concepto_precios` compara estrictamente el `tenant_id` del concepto con el de la tarifa. Cuando el super admin (que pertenece a un tenant diferente, ej: su propio tenant) crea un concepto y quiere asignarle un precio en una tarifa de Beraexpress (otro tenant), el trigger rechaza la operacion porque los tenant_id no coinciden.

Tambien falla cuando el concepto tiene `tenant_id = NULL` (concepto global), ya que `NULL IS DISTINCT FROM uuid` siempre es `true`.

## Solucion

Modificar la funcion `validate_concepto_tenant` para:

1. Si el concepto tiene `tenant_id = NULL` (concepto global), permitir la asociacion con cualquier tarifa
2. Si el usuario actual es super admin, permitir la operacion sin restriccion de tenant
3. Solo aplicar la validacion estricta para usuarios normales

## Cambio en base de datos

Una sola migracion que reemplaza la funcion del trigger:

```sql
CREATE OR REPLACE FUNCTION public.validate_concepto_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_concepto_tenant_id UUID;
  v_tarifa_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_concepto_tenant_id FROM tarifa_conceptos WHERE id = NEW.concepto_id;
  SELECT tenant_id INTO v_tarifa_tenant_id FROM tarifas WHERE id = NEW.tarifa_id;
  
  -- Permitir conceptos globales (sin tenant) en cualquier tarifa
  IF v_concepto_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Permitir si el usuario es super admin
  IF public.current_user_is_super_admin() THEN
    RETURN NEW;
  END IF;
  
  -- Validacion normal: deben coincidir los tenants
  IF v_concepto_tenant_id IS DISTINCT FROM v_tarifa_tenant_id THEN
    RAISE EXCEPTION 'El concepto (tenant %) no pertenece al mismo tenant que la tarifa (tenant %)',
      v_concepto_tenant_id, v_tarifa_tenant_id;
  END IF;
  
  RETURN NEW;
END;
$$;
```

No se requieren cambios en el frontend. Solo esta migracion resuelve el error.

| Archivo | Cambio |
|---|---|
| Migracion SQL | Actualizar funcion `validate_concepto_tenant` para permitir NULL y bypass para super admins |

