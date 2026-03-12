

# Fix: Envíos recibidos por sucursal incorrecta no aparecen para reenvío

## Problema

Cuando una sucursal recibe por error envíos destinados a otra (ej: una hoja de ruta iba a Mar del Plata pero la recibe otra sucursal), esos envíos no aparecen disponibles para crear una nueva hoja de ruta hacia el destino correcto.

**Causa raíz en `src/pages/RouteSheets.tsx`, línea 285:**

```typescript
.eq("sucursal_origen_id", profile.sucursal_id)
```

Este filtro solo muestra envíos cuya **sucursal de origen** sea la sucursal actual. Pero cuando una sucursal intermedia recibe los paquetes, el `sucursal_origen_id` sigue apuntando al remitente original (ej: Bahía Blanca), no a la sucursal que los tiene físicamente. Entonces la sucursal intermedia nunca los ve.

## Fix

### `src/pages/RouteSheets.tsx` (líneas 279-291)

Ampliar el filtro de envíos pendientes para incluir **también** los envíos que están físicamente en la sucursal actual (`en_sucursal`) aunque no sean la sucursal de origen. El criterio debe ser:

- Envíos con `sucursal_origen_id = mi sucursal` (flujo normal), **O**
- Envíos con estado `en_sucursal` que fueron recibidos en mi sucursal (la última recepción los dejó acá)

La forma más limpia es usar un filtro `.or()` que incluya ambos escenarios:

```typescript
const { data, error } = await supabase
  .from("envios")
  .select(`
    *,
    destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido)
  `)
  .eq("sucursal_destino_id", selectedDestino)
  .in("estado", ["pendiente", "recogido", "en_sucursal"])
  .is("chofer_id", null)
  .or(`sucursal_origen_id.eq.${profile.sucursal_id},sucursal_entrega_id.eq.${profile.sucursal_id}`);
```

**Lógica**: `sucursal_entrega_id` se setea en `ReceiveShipmentDialog` (línea 64) cuando una sucursal no-centro recibe un paquete. Esto identifica dónde está físicamente el paquete. Al incluir este campo en el filtro OR, la sucursal intermedia podrá ver los envíos que tiene en su poder y re-despacharlos.

### Consideración adicional

Si `sucursal_entrega_id` no se setea siempre (por ejemplo si se recibe via `ReceiveRouteSheetDialog` que no lo setea), agregar la misma lógica en `ReceiveRouteSheetDialog.tsx` línea 101-104 para que también guarde `sucursal_entrega_id` con la sucursal del usuario receptor.

