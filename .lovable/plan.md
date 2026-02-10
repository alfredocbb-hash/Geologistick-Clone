

# Fix sync timeout + Agrupar pedidos por seller con seleccion masiva

## Problema 1: Error "Failed to send a request to the Edge Function"

Los logs muestran que la sincronizacion SI se completa exitosamente (Created: 0, Existing: 61, Errors: 0), pero tarda tanto que la conexion HTTP se cierra antes de recibir la respuesta (`Http: connection closed before message completed`). El problema es que para cada una de las 80 ordenes, la funcion hace multiples consultas secuenciales a la base de datos (3 queries por orden existente, mas una llamada a la API de ML + varios inserts por orden nueva).

## Problema 2: Agrupar por seller y seleccionar todos

La tabla de pedidos muestra todo plano sin agrupacion. Necesitas poder ver los envios agrupados por seller, seleccionar todos los de un seller de un click, y enviarlos al planificador.

---

## Cambios propuestos

### 1. Optimizar mercadolibre-sync para evitar timeout

**Archivo: `supabase/functions/mercadolibre-sync/index.ts`**

- **Para ordenes existentes**: En lugar de hacer 3 queries individuales por cada orden (update order, select total, update envio), agrupar las actualizaciones. Simplificar el bloque "existing" para hacer solo 1 update de ecommerce_orders y 1 update de envios, eliminando la query intermedia de recalculo de total (ya se hizo retroactivamente).
- **Para ordenes nuevas**: Antes de hacer el fetch individual de `/shipments/{id}` (que es la llamada mas lenta), verificar primero si la orden ya existe en ecommerce_orders por `ml_shipment_id` para evitar el fetch innecesario.
- **Batch existentes**: Recopilar todos los shipment IDs existentes de una sola vez al inicio con un solo query (`select ml_shipment_id from envios where ml_shipment_id in (...)`), en lugar de consultar uno por uno.

Esto reducira el tiempo de procesamiento de ~20s a ~5s para 80 ordenes.

### 2. Agrupar pedidos por seller en la tabla de Orders

**Archivo: `src/pages/ecommerce/Orders.tsx`**

- Agrupar `filteredOrders` por `seller?.nombre` (o seller_id).
- Renderizar una fila de encabezado por cada seller con:
  - Nombre del seller
  - Cantidad de pedidos
  - Checkbox para seleccionar/deseleccionar todos los pedidos de ese seller
  - Boton rapido "Enviar al Planificador" por seller
- Debajo del encabezado, las filas normales de pedidos de ese seller.
- Mantener el checkbox individual por pedido y el checkbox global existente.

---

## Seccion tecnica

| Archivo | Cambio |
|---|---|
| `supabase/functions/mercadolibre-sync/index.ts` | Batch lookup de existentes con un solo query; simplificar updates de ordenes existentes |
| `src/pages/ecommerce/Orders.tsx` | Agrupar pedidos por seller con header de grupo, checkbox por grupo, y boton de planificador por grupo |

### Detalle de la optimizacion del sync

```text
ANTES (por cada una de las 80 ordenes):
  1. SELECT envios WHERE ml_shipment_id = X
  2. UPDATE ecommerce_orders (status)
  3. SELECT ecommerce_orders (total check)
  4. UPDATE envios (estado)
  = 4 queries x 80 = 320 queries secuenciales

DESPUES:
  1. SELECT envios WHERE ml_shipment_id IN (...todos...)  -> 1 query
  2. Para cada existente: UPDATE ecommerce_orders + UPDATE envios = 2 queries
  3. Para cada nueva: fetch ML API + inserts (sin cambio)
  = 1 + (2 x 61 existentes) + (API calls solo para nuevas) = ~123 queries
```

### Detalle del agrupamiento visual

```text
+--------------------------------------------------+
| [x] Kingdom (25 pedidos)        [Planificar]     |
+--------------------------------------------------+
|  [ ] #12345  Juan Perez   Pagado  Sin Preparar   |
|  [ ] #12346  Maria Lopez  Pagado  Sin Preparar   |
|  ...                                              |
+--------------------------------------------------+
| [x] Otro Seller (10 pedidos)    [Planificar]     |
+--------------------------------------------------+
|  [ ] #12400  Carlos Ruiz  Pagado  Sin Preparar   |
|  ...                                              |
```

