
# Fix: Sellers sin remitente en envios de MercadoLibre + Sincronizacion Seller-Cliente

## Problema 1: Envios sin remitente

Cuando se crean envios desde MercadoLibre (por sync, webhook o escaneo QR), nunca se asigna el campo `nombre_remitente` ni `remitente_id` en la tabla `envios`. Esto hace que en el modulo general de Shipments el remitente aparezca vacio ("-").

## Problema 2: Seller y Cliente desvinculados

Actualmente no hay relacion entre `ecommerce_sellers` y `clientes`. Si un seller ya esta cargado como cliente, no se vinculan. Esto impide usar `remitente_id` y pierde la consistencia de datos.

## Solucion

### Parte A: Vincular Seller con Cliente

1. **Agregar columna `cliente_id`** a la tabla `ecommerce_sellers` (FK opcional a `clientes`).

2. **Modificar `CreateSellerDialog.tsx`**: al crear un seller, buscar automaticamente si ya existe un cliente con el mismo email o telefono en el mismo tenant. Si existe, vincularlo (`cliente_id`). Si no existe, crear uno nuevo en la tabla `clientes` con los datos del seller.

3. **Modificar `EditSellerDialog.tsx`**: misma logica al editar (si no tiene `cliente_id` aun, buscarlo/crearlo).

### Parte B: Asignar remitente en envios de ML

4. **Modificar `register-ml-shipment/index.ts`**: despues de encontrar el seller, setear `nombre_remitente: seller.nombre` y `remitente_id: seller.cliente_id` (si existe) en el insert del envio.

5. **Modificar `mercadolibre-sync/index.ts`**: misma logica, agregar `nombre_remitente` y `remitente_id` al crear cada envio.

6. **Modificar `mercadolibre-webhook/index.ts`**: misma logica, agregar `nombre_remitente` y `remitente_id` al crear envio desde webhook.

### Parte C: Fix retroactivo

7. **Ejecutar un UPDATE** para los envios existentes de ML que no tienen remitente, vinculandolos con el seller correspondiente a traves de la tabla `ecommerce_orders`.

## Seccion tecnica

### Migracion SQL

```sql
-- 1. Agregar cliente_id a ecommerce_sellers
ALTER TABLE ecommerce_sellers ADD COLUMN cliente_id uuid REFERENCES clientes(id);

-- 2. Fix retroactivo: poner nombre_remitente en envios ML existentes
UPDATE envios e
SET nombre_remitente = s.nombre
FROM ecommerce_orders eo
JOIN ecommerce_sellers s ON eo.seller_id = s.id
WHERE eo.envio_id = e.id
  AND e.nombre_remitente IS NULL
  AND e.ml_shipment_id IS NOT NULL;
```

### Archivos modificados

**`src/components/ecommerce/CreateSellerDialog.tsx`**
- Despues de insertar el seller, buscar cliente existente por email/telefono en el mismo tenant
- Si existe: actualizar `ecommerce_sellers.cliente_id`
- Si no existe: crear cliente nuevo con los datos del seller, luego vincular

**`src/components/ecommerce/EditSellerDialog.tsx`**
- Si el seller no tiene `cliente_id`, ejecutar la misma logica de busqueda/creacion

**`supabase/functions/register-ml-shipment/index.ts`** (lineas 280-308)
- Agregar al insert de envio:
  - `nombre_remitente: seller.nombre`
  - `remitente_id: seller.cliente_id || null`

**`supabase/functions/mercadolibre-sync/index.ts`** (lineas 294-321)
- Agregar al insert de envio:
  - `nombre_remitente: seller.nombre`
  - `remitente_id: seller.cliente_id || null`

**`supabase/functions/mercadolibre-webhook/index.ts`** (lineas ~170-200)
- Agregar al insert de envio:
  - `nombre_remitente: seller.nombre`
  - `remitente_id: seller.cliente_id || null`

### Resultado

- Los envios de ML mostraran el nombre del seller como remitente en todas las vistas
- Al crear/editar un seller se vincula automaticamente con la tabla de clientes
- Los envios existentes se corrigen retroactivamente
