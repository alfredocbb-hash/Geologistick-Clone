

# Fix: Envíos recibidos no aparecen para re-despacho (RLS + Frontend)

## Problema raíz

El filtro `.or()` que agregamos en `RouteSheets.tsx` es correcto a nivel frontend, pero **la política RLS de la tabla `envios` bloquea los resultados antes de que lleguen al frontend**. 

La política actual "Ver envíos de su tenant" para roles `sucursal`/`despachador` solo permite ver envíos donde:
- `sucursal_origen_id = mi_sucursal` OR `sucursal_destino_id = mi_sucursal`

**No incluye `sucursal_entrega_id`** (ubicación física actual). Entonces cuando una sucursal intermedia recibe un paquete, RLS lo filtra y nunca llega al frontend.

El mismo problema existe en la política de UPDATE: la sucursal intermedia no puede actualizar envíos que tiene físicamente porque RLS no reconoce `sucursal_entrega_id`.

## Cambios necesarios

### 1. Migración SQL: Actualizar RLS SELECT en `envios`

Agregar `sucursal_entrega_id = get_user_sucursal(auth.uid())` como condición OR adicional en la política "Ver envíos de su tenant":

```sql
DROP POLICY IF EXISTS "Ver envíos de su tenant" ON envios;

CREATE POLICY "Ver envíos de su tenant" ON envios
FOR SELECT
USING (
  (
    (tenant_id = current_user_tenant())
    AND (
      is_admin(auth.uid())
      OR has_role(auth.uid(), 'supervisor')
      OR has_role(auth.uid(), 'chofer')
      OR has_role(auth.uid(), 'operador')
      OR has_role(auth.uid(), 'bodega')
      OR (sucursal_origen_id = get_user_sucursal(auth.uid()))
      OR (sucursal_destino_id = get_user_sucursal(auth.uid()))
      OR (sucursal_entrega_id = get_user_sucursal(auth.uid()))
      OR (chofer_id = auth.uid())
    )
  )
  OR is_super_admin(auth.uid())
);
```

### 2. Migración SQL: Actualizar RLS UPDATE en `envios`

Agregar `sucursal_entrega_id = current_user_sucursal()` para roles `sucursal`, `operador`, `despachador`:

```sql
DROP POLICY IF EXISTS "Actualizar envíos de su tenant" ON public.envios;

CREATE POLICY "Actualizar envíos de su tenant" ON public.envios
FOR UPDATE TO authenticated
USING (
  tenant_id = public.current_user_tenant()
  AND (
    public.is_admin(auth.uid())
    OR chofer_id = auth.uid()
    OR (
      public.current_user_has_role('sucursal'::app_role)
      AND (
        sucursal_origen_id = public.current_user_sucursal()
        OR sucursal_destino_id = public.current_user_sucursal()
        OR sucursal_entrega_id = public.current_user_sucursal()
      )
    )
    OR (
      public.current_user_has_role('operador'::app_role)
      AND (
        sucursal_origen_id = public.current_user_sucursal()
        OR sucursal_destino_id = public.current_user_sucursal()
        OR sucursal_entrega_id = public.current_user_sucursal()
      )
    )
    OR (
      public.current_user_has_role('despachador'::app_role)
      AND (
        sucursal_origen_id = public.current_user_sucursal()
        OR sucursal_destino_id = public.current_user_sucursal()
        OR sucursal_entrega_id = public.current_user_sucursal()
      )
    )
  )
  OR public.is_super_admin(auth.uid())
);
```

### 3. `src/pages/RouteSheets.tsx`: Ampliar filtro de envíos pendientes

El filtro actual ya incluye el OR con `sucursal_entrega_id` (del fix anterior). Adicionalmente, incluir envíos que no tienen `sucursal_destino_id` definido (modo mixto):

```typescript
// Línea 285: incluir envíos sin destino que están físicamente en mi sucursal
.or(`sucursal_destino_id.eq.${selectedDestino},and(sucursal_destino_id.is.null,sucursal_entrega_id.eq.${profile.sucursal_id})`)
```

Wait - releyendo la query actual, el filtro ya hace `.eq("sucursal_destino_id", selectedDestino)` como condición fija. Para el modo mixto (envíos sin destino + envíos con destino correcto), necesitamos reestructurar:

```typescript
const { data, error } = await supabase
  .from("envios")
  .select(`...`)
  .in("estado", ["pendiente", "recogido", "en_sucursal"])
  .is("chofer_id", null)
  .or(`sucursal_origen_id.eq.${profile.sucursal_id},sucursal_entrega_id.eq.${profile.sucursal_id}`)
  .or(`sucursal_destino_id.eq.${selectedDestino},sucursal_destino_id.is.null`);
```

Esto muestra envíos que:
- Están en mi sucursal (origen o físicamente) Y
- Van al destino seleccionado O no tienen destino asignado

### 4. Datos existentes: Fix envío ENV-NHJR8H

Actualizar el envío que ya existe para que `sucursal_entrega_id` apunte a la sucursal que lo tiene (79308c0c = Administracion, que es donde fue recibido según el historial):

```sql
UPDATE envios SET sucursal_entrega_id = '79308c0c-1892-4de5-be76-437d259bdbaa' WHERE tracking_number = 'ENV-NHJR8H';
```

