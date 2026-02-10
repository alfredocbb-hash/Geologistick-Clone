

# Sellers manuales multi-plataforma + Mostrar costo de envio en pedidos

## Problema 1: Sellers manuales no pueden conectar tiendas

Cuando se crea un seller como "Manual", luego no hay forma de cambiar la plataforma ni conectar MercadoLibre u otra tienda. La columna "Conexion" muestra "N/A" sin opcion de accion.

## Problema 2: Se muestra el importe del producto en vez del envio

La columna "Total" en la tabla de pedidos e-Commerce muestra la suma de precios de los productos del vendedor (`unit_price * quantity`). Lo que necesitas ver es el costo de envio que cobra MercadoLibre (almacenado en `shipping_cost` de la orden y `precio_flete_ml` del envio).

## Cambios propuestos

### 1. Permitir cambiar plataforma desde el EditSellerDialog

**Archivo: `src/components/ecommerce/EditSellerDialog.tsx`**
- Actualmente el campo `plataforma` se guarda pero no se puede editar visualmente en el formulario de edicion (no hay un Select para plataforma en el form de edicion, solo en el de creacion).
- Agregar el Select de plataforma al formulario de edicion, permitiendo cambiar de "Manual" a "MercadoLibre", "Tiendanube", etc.

### 2. Mostrar boton "Conectar" para sellers manuales en la tabla

**Archivo: `src/pages/ecommerce/Sellers.tsx`**
- Linea 456: donde dice `seller.plataforma === 'manual'` y muestra "N/A", cambiarlo por un dropdown con opciones de conexion: "Conectar MercadoLibre" y "Conectar Tiendanube".
- Al elegir una opcion: actualizar la plataforma del seller en la DB y luego abrir el popup OAuth correspondiente.

### 3. Mostrar costo de envio en vez de total de productos

**Archivo: `src/pages/ecommerce/Orders.tsx`**
- Linea 367: Cambiar el header de columna de "Total" a "Costo Envio"
- Linea 416-418: En la celda, mostrar `order.shipping_cost` en lugar de `order.total`. Si `shipping_cost` es null o 0, mostrar un guion "-" como fallback.

**Archivo: `src/components/ecommerce/OrderDetailsDialog.tsx`**
- En la seccion de "Totales", agregar claramente la distincion entre el total de productos (subtotal) y el costo de envio de la plataforma.
- Resaltar visualmente el costo de envio como el valor principal.

### 4. Guardar shipping_cost desde ML sync

**Archivo: `supabase/functions/mercadolibre-sync/index.ts`**
- Linea 279: Ademas de `total: orderTotal`, agregar `shipping_cost: mlShippingCost` al insert de la orden e-commerce, para que el costo de envio quede disponible en la tabla de ordenes.

**Archivo: `supabase/functions/register-ml-shipment/index.ts`**
- Misma logica: guardar `shipping_cost: mlShippingCost` en el insert de `ecommerce_orders`.

**Archivo: `supabase/functions/mercadolibre-webhook/index.ts`**
- Misma logica al crear ordenes desde webhook.

### 5. Fix retroactivo

- Ejecutar un UPDATE para llenar `shipping_cost` en ordenes ML existentes usando el valor de `precio_flete_ml` del envio vinculado:

```sql
UPDATE ecommerce_orders eo
SET shipping_cost = e.precio_flete_ml
FROM envios e
WHERE eo.envio_id = e.id
  AND e.precio_flete_ml IS NOT NULL
  AND e.precio_flete_ml > 0
  AND (eo.shipping_cost IS NULL OR eo.shipping_cost = 0);
```

## Seccion tecnica - Resumen de archivos

| Archivo | Cambio |
|---|---|
| `src/pages/ecommerce/Sellers.tsx` | Reemplazar "N/A" en sellers manuales por dropdown de conexion con opciones ML/TN |
| `src/components/ecommerce/EditSellerDialog.tsx` | Agregar Select de plataforma al formulario |
| `src/pages/ecommerce/Orders.tsx` | Columna "Total" pasa a "Costo Envio", mostrar `shipping_cost` |
| `src/components/ecommerce/OrderDetailsDialog.tsx` | Resaltar costo de envio en seccion Totales |
| `supabase/functions/mercadolibre-sync/index.ts` | Agregar `shipping_cost` al insert de orden |
| `supabase/functions/register-ml-shipment/index.ts` | Agregar `shipping_cost` al insert de orden |
| `supabase/functions/mercadolibre-webhook/index.ts` | Agregar `shipping_cost` al insert de orden |
| Migracion SQL | UPDATE retroactivo de `shipping_cost` en ordenes existentes |
