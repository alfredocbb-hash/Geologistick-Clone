

# Congelar precio de tarifa en el envío al momento de creación

## Problema
Actualmente, las liquidaciones recalculan el precio de cada envío en tiempo real usando la tarifa vigente. Si actualizás las tarifas hoy, los envíos de ayer (aún no liquidados) se recalculan con los precios nuevos.

## Solución
Agregar un campo `precio_tarifa_vigente` en la tabla `envios` que congele el precio de la tarifa al momento de crear el envío. La liquidación usará ese precio congelado en vez de recalcular desde la tarifa actual.

## Cambios

### 1. Migración SQL
- Agregar columna `precio_tarifa_vigente NUMERIC DEFAULT NULL` a `envios`
- Ejecutar UPDATE masivo: para todos los envíos existentes sin liquidación, copiar el `precio_total` actual a `precio_tarifa_vigente` (esto congela el precio vigente hasta ayer)

### 2. Liquidaciones (`src/pages/ecommerce/Settlements.tsx`)
- En el cálculo de envíos (líneas ~561-685), agregar prioridad:
  1. Si `precio_tarifa_vigente` existe → usarlo directamente (sin recalcular)
  2. Si no existe → aplicar la lógica actual (tarifa asignada → zona → fallback)
- Esto significa que envíos viejos usan el precio congelado, y envíos nuevos (creados después de actualizar tarifas) tendrán el precio nuevo congelado

### 3. Saldos por Seller (`src/pages/ecommerce/Settlements.tsx`)
- Misma lógica en el cálculo de balances (líneas ~280-325): priorizar `precio_tarifa_vigente`

### 4. Creación de envíos — congelar precio automáticamente
- **Webhook ML** (`supabase/functions/mercadolibre-webhook/index.ts`): guardar `precio_tarifa_vigente` junto con `precio_total`
- **Sync ML** (`supabase/functions/mercadolibre-sync/index.ts`): guardar `precio_tarifa_vigente` junto con `precio_total`
- **Crear envío desde orden** (`src/components/ecommerce/CreateShipmentFromOrderDialog.tsx`): guardar `precio_tarifa_vigente`
- **Nuevo envío manual** (`src/pages/NewShipment.tsx`): guardar `precio_tarifa_vigente` = `precioCalculado`
- **Register ML shipment** (`supabase/functions/register-ml-shipment/index.ts`): guardar `precio_tarifa_vigente`

## Flujo después del cambio

1. Hoy generás la liquidación pendiente (o no, da igual)
2. Los envíos existentes ya tienen `precio_tarifa_vigente` congelado con el precio viejo
3. Actualizás las tarifas
4. Los envíos nuevos que se creen a partir de ahora guardan el precio nuevo en `precio_tarifa_vigente`
5. Al liquidar, cada envío usa su propio precio congelado → no hay mezcla de precios

