

# Mostrar estados de envío de MercadoLibre en Pedidos

## Problema

La columna "Estado" en pedidos solo muestra "Pagado" (valor generico `order_status = 'paid'`) porque el sistema no guarda el estado de envio real de MercadoLibre (`ready_to_ship`, `shipped`, `delivered`, etc.). Este dato SI esta disponible durante la sincronizacion pero no se persiste.

## Cambios propuestos

### 1. Nueva columna en la base de datos

Agregar `ml_shipping_status` (TEXT) a la tabla `ecommerce_orders` para guardar el estado de envio nativo de ML.

### 2. Guardar el estado ML durante la sincronizacion

**Archivo: `supabase/functions/mercadolibre-sync/index.ts`**

- Al crear ordenes nuevas: guardar `orderItem.shipping.status` en `ml_shipping_status`
- Al actualizar ordenes existentes: actualizar `ml_shipping_status` con el valor actual

### 3. Mostrar el estado ML en la tabla de Pedidos

**Archivo: `src/pages/ecommerce/Orders.tsx`**

- Reemplazar el badge de `order_status` ("Pagado") por el de `ml_shipping_status` cuando exista
- Agregar mapeo de estados ML a etiquetas en espanol con colores:

| Estado ML | Etiqueta | Color |
|---|---|---|
| `ready_to_ship` | Listo para enviar | Azul |
| `shipped` | En camino | Naranja |
| `delivered` | Entregado | Verde |
| `not_delivered` | No entregado | Rojo |
| `cancelled` | Cancelado | Gris |

- Actualizar el filtro de estado para incluir estos valores ML
- Mantener el `order_status` generico como fallback para ordenes de Tiendanube u otras plataformas

### 4. Actualizar ordenes existentes

Ejecutar un UPDATE para poblar `ml_shipping_status` en las ordenes existentes que ya tienen datos en `raw_data`, extrayendo el valor de `raw_data->'status'` o basandose en el `fulfillment_status` actual.

---

## Seccion tecnica

| Archivo | Cambio |
|---|---|
| Migracion SQL | `ALTER TABLE ecommerce_orders ADD COLUMN ml_shipping_status TEXT` + UPDATE de datos existentes |
| `supabase/functions/mercadolibre-sync/index.ts` | Guardar `ml_shipping_status` en INSERT y UPDATE |
| `src/pages/ecommerce/Orders.tsx` | Nuevo mapeo `ML_SHIPPING_CONFIG`, mostrar badge ML, actualizar filtro de estado |

### Mapeo en el sync

```text
orderItem.shipping.status -> ecommerce_orders.ml_shipping_status

Valores posibles de ML API:
- pending, ready_to_ship, shipped, delivered, not_delivered, cancelled
```

### Backfill de datos existentes

```text
UPDATE ecommerce_orders
SET ml_shipping_status = CASE
  WHEN fulfillment_status = 'delivered' THEN 'delivered'
  WHEN fulfillment_status = 'shipped' THEN 'shipped'
  WHEN order_status = 'cancelled' THEN 'cancelled'
  ELSE 'ready_to_ship'
END
WHERE plataforma = 'mercadolibre' AND ml_shipping_status IS NULL;
```
