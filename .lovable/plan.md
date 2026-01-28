
# Plan: Corregir RLS para Permitir a Choferes Escanear Envíos de su Tenant

## Problema Identificado

El chofer **Alfred Bernard** intenta escanear el envío `ADMIN-ENV-20260128-897A99` pero recibe "Envío no encontrado".

### Análisis de la Situación

| Dato | Valor |
|------|-------|
| Tracking escaneado | `ADMIN-ENV-20260128-897A99` |
| Envío existe en BD | ✅ Sí |
| Tenant del envío | `Beraexpress` |
| Sucursal origen del envío | `Administración` |
| Sucursal del chofer | `Berazategui (SUC01)` |
| Chofer asignado al envío | ❌ Ninguno (`chofer_id = NULL`) |

### Política RLS Actual para SELECT en `envios`

```text
tenant_id = current_user_tenant() 
AND (
    is_admin() 
    OR has_role('supervisor') 
    OR sucursal_origen_id = get_user_sucursal()  ← FALLA (diferente sucursal)
    OR sucursal_destino_id = get_user_sucursal() ← FALLA (NULL)
    OR chofer_id = auth.uid()                     ← FALLA (NULL)
    OR created_by = auth.uid()                    ← FALLA (otro usuario)
)
```

**Resultado**: El chofer no cumple ninguna condición, por lo tanto RLS bloquea la lectura.

---

## Contexto de Negocio

Los choferes necesitan poder escanear CUALQUIER envío de su empresa para:

1. **En bodega**: Cargar envíos a su ruta (aún sin asignar)
2. **En sucursal partner**: Recibir envíos para última milla
3. **En la calle**: Verificar datos de un paquete encontrado

La restricción actual impide que un chofer escanee envíos que:
- Fueron creados en otra sucursal
- No tienen chofer asignado todavía
- Están destinados a sucursales diferentes

---

## Solución Propuesta

### Opción A: Agregar rol `chofer` a la política RLS (Recomendado)

Modificar la política para que los choferes puedan ver todos los envíos de su tenant:

```sql
ALTER POLICY "Ver envíos de su tenant" ON envios
USING (
  (
    tenant_id = current_user_tenant() 
    AND (
      is_admin(auth.uid()) 
      OR has_role(auth.uid(), 'supervisor')
      OR has_role(auth.uid(), 'chofer')        -- ← AGREGAR
      OR has_role(auth.uid(), 'operador')      -- ← AGREGAR
      OR has_role(auth.uid(), 'bodega')        -- ← AGREGAR
      OR sucursal_origen_id = get_user_sucursal(auth.uid()) 
      OR sucursal_destino_id = get_user_sucursal(auth.uid()) 
      OR chofer_id = auth.uid() 
      OR created_by = auth.uid()
    )
  ) 
  OR is_super_admin(auth.uid())
);
```

### Justificación

Los roles que necesitan ver todos los envíos del tenant son:
- **chofer**: Para cargar y escanear en bodega
- **operador**: Para gestionar operaciones
- **bodega**: Para recibir y despachar

Esto alinea con la memoria existente que indica que los choferes deben poder ver todos los envíos de su empresa.

---

## Migración SQL Requerida

```sql
-- Actualizar política RLS para envios (SELECT)
DROP POLICY IF EXISTS "Ver envíos de su tenant" ON envios;

CREATE POLICY "Ver envíos de su tenant" ON envios
FOR SELECT
USING (
  (
    (tenant_id = current_user_tenant())
    AND (
      is_admin(auth.uid())
      OR has_role(auth.uid(), 'supervisor'::app_role)
      OR has_role(auth.uid(), 'chofer'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'bodega'::app_role)
      OR (sucursal_origen_id = get_user_sucursal(auth.uid()))
      OR (sucursal_destino_id = get_user_sucursal(auth.uid()))
      OR (chofer_id = auth.uid())
      OR (created_by = auth.uid())
    )
  )
  OR is_super_admin(auth.uid())
);
```

---

## Impacto

### Antes del Cambio
- Choferes solo ven envíos de su sucursal o asignados a ellos
- No pueden escanear envíos de otras sucursales del mismo tenant
- Error "Envío no encontrado" al escanear paquetes sin asignar

### Después del Cambio
- Choferes pueden ver todos los envíos de su empresa (tenant)
- Pueden escanear cualquier paquete en bodega para cargarlo a su ruta
- Pueden verificar datos de cualquier envío de la empresa

### Seguridad
- Los choferes siguen sin poder ver envíos de OTROS tenants
- Solo afecta la visibilidad, no la capacidad de modificar
- La política de UPDATE sigue requiriendo ser admin o ser el chofer asignado

---

## Resultado Esperado

Después de aplicar la migración:

1. El chofer Alfred Bernard podrá escanear `ADMIN-ENV-20260128-897A99`
2. El sistema mostrará los datos del envío correctamente
3. Podrá proceder con la operación de colecta o entrega según corresponda
