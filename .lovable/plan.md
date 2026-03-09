

# Fix: Filtrado por fecha de entrega y nombres de destinatario en liquidaciones seller

## Problemas identificados

### 1. Filtro por fecha incorrecta
En `Settlements.tsx` línea 400-406, la query de ecommerce_orders filtra por `fecha_entrega_estimada` (fecha estimada de la orden e-commerce). Debería filtrar por `fecha_entrega` del envío vinculado, que es la fecha real de entrega.

### 2. Nombres de destinatario vacíos en envíos manuales
En `NewShipment.tsx`, al crear un envío manual, el campo `nombre_destinatario` NO se incluye en el INSERT (líneas 1160-1209). El nombre queda solo en la tabla `clientes` (via `destinatario_id`). Las queries de liquidaciones solo leen `envios.nombre_destinatario`, que para envíos manuales es `null`.

## Cambios

### `src/pages/ecommerce/Settlements.tsx`

**Filtro de fecha**: Cambiar la estrategia de búsqueda de envíos e-commerce. En lugar de filtrar `ecommerce_orders` por `fecha_entrega_estimada`, obtener los `envio_id` de ecommerce_orders sin filtro de fecha, y luego filtrar los envíos por `fecha_entrega` en la tabla `envios` (igual que se hace con los envíos comunes).

Concretamente:
- Líneas 400-406: Quitar los filtros `.gte('fecha_entrega_estimada')` / `.lte('fecha_entrega_estimada')` de la query a `ecommerce_orders`
- Líneas 422-431: En la query a `envios`, agregar filtros `.gte('fecha_entrega', fechaInicioStr)` / `.lte('fecha_entrega', fechaFinStr)` y también incluir un fallback para envíos sin `fecha_entrega` (filtrar por `created_at`), similar a como se hace con envíos comunes (líneas 451-484)

**Nombres de destinatario**: En todas las queries que seleccionan envíos (líneas 425, 454, 466), agregar un join con `clientes` via `destinatario_id` para obtener el nombre cuando `nombre_destinatario` es null:
- Cambiar el select a incluir `destinatario:clientes(nombre, apellido)`
- En el mapeo de resultados, usar `nombre_destinatario || (destinatario?.nombre + ' ' + destinatario?.apellido)` como fallback

### `src/components/ecommerce/SellerLiquidacionDetailDialog.tsx`

**Nombres de destinatario en el detalle**: En la query de línea 63-68, agregar el join con clientes:
- Cambiar select para incluir `destinatario:clientes(nombre, apellido)`
- En la tabla (línea 430), usar el fallback: `envio.nombre_destinatario || (destinatario nombre+apellido) || '-'`

### `src/pages/NewShipment.tsx`

**Prevención futura**: En el INSERT de envíos (línea 1160-1209), agregar `nombre_destinatario` con el valor del formulario (`formData.destinatario_nombre + ' ' + formData.destinatario_apellido`). Esto asegura que futuros envíos manuales tengan el nombre directamente en la tabla `envios`.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/ecommerce/Settlements.tsx` | Filtrar por `fecha_entrega` del envío; join con `clientes` para nombres |
| `src/components/ecommerce/SellerLiquidacionDetailDialog.tsx` | Join con `clientes` para nombres en detalle |
| `src/pages/NewShipment.tsx` | Agregar `nombre_destinatario` y `nombre_remitente` al INSERT |

