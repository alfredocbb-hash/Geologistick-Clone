

# Sincronizacion automatica de estados con MercadoLibre + Tracking y QR nativos

## Resumen

Este plan combina dos mejoras: (1) usar el numero de envio original de MercadoLibre en lugar de generar uno interno, mostrar el QR y permitir descargar la etiqueta; y (2) sincronizar automaticamente los cambios de estado del envio hacia la API de MercadoLibre mediante un trigger en la base de datos que invoca el Edge Function existente.

---

## Parte 1: Tracking nativo de ML, QR y etiqueta

### 1.1 Migracion SQL

- Agregar columnas `ml_shipment_id` (BIGINT) y `ml_tracking_number` (TEXT) a `ecommerce_orders`
- Actualizar registros existentes extrayendo datos de `raw_data`

### 1.2 Edge Functions: Usar tracking de ML

**`supabase/functions/mercadolibre-sync/index.ts`**
- Reemplazar generacion de tracking (lineas 197-200) por `ML-{shipment.id}`
- Guardar `ml_shipment_id` y `ml_tracking_number` en el insert de `ecommerce_orders`

**`supabase/functions/register-ml-shipment/index.ts`**
- Usar `ML-{ml_shipment_id}` como tracking principal (ya tiene el fallback en linea 204, hacerlo principal)
- Guardar `ml_shipment_id` y `ml_tracking_number` en `ecommerce_orders`

### 1.3 Nuevo Edge Function: Proxy para etiqueta ML

**`supabase/functions/mercadolibre-label/index.ts`** (nuevo)
- Recibe `shipment_id` como parametro
- Busca el envio para obtener el `tenant_id`, luego el seller con access_token
- Llama a `https://api.mercadolibre.com/shipment_labels?shipment_ids={id}&response_type=pdf`
- Retorna el PDF al frontend (proxy autenticado)

### 1.4 Frontend: Mostrar info ML en pedidos

**`src/pages/ecommerce/Orders.tsx`**
- En la columna "Envio", para pedidos ML con `ml_shipment_id`:
  - Mostrar numero de envio ML en lugar de solo "Creado"
  - Agregar boton para descargar etiqueta PDF de ML

**`src/components/ecommerce/OrderDetailsDialog.tsx`**
- Agregar seccion "Envio MercadoLibre" cuando `plataforma === 'mercadolibre'` y hay `ml_shipment_id`
- Mostrar QR con `qrcode.react` (ya instalada) con el JSON `{"id":"...","sender_id":"..."}`
- Mostrar numero de envio ML, tipo logistico
- Boton "Descargar Etiqueta ML"

---

## Parte 2: Sincronizacion automatica de estados hacia ML

### Situacion actual

Cuando un envio cambia de estado en el sistema:
1. El trigger `sync_ecommerce_order_status` actualiza `ecommerce_orders` (fulfillment/order status) -- esto ya funciona
2. La sincronizacion hacia la API de ML solo se ejecuta manualmente desde el dialogo del driver movil (`MLDeliveryDialog.tsx`)

Esto significa que si un operador cambia el estado desde la web (ej: marca como entregado desde Envios), ML no se entera.

### Solucion: Trigger + pg_net (llamada HTTP desde la DB)

Se creara un trigger en la base de datos que, al detectar un cambio de estado en un envio con `ml_shipment_id`, invoque automaticamente el Edge Function `mercadolibre-update-status` usando `pg_net` (extension de Supabase para hacer HTTP desde SQL).

**Migracion SQL:**

```text
1. Habilitar la extension pg_net (si no esta habilitada)
2. Crear funcion: auto_sync_ml_status()
   - Se ejecuta AFTER UPDATE OF estado ON envios
   - Solo actua si el envio tiene ml_shipment_id (es un envio de ML)
   - Solo actua si el estado realmente cambio
   - Hace POST via pg_net al edge function mercadolibre-update-status
     con body: { envio_id, estado }
   - Usa SUPABASE_URL + service_role_key del vault
3. Crear trigger: trigger_auto_sync_ml_status
```

### Flujo resultante

```text
Operador cambia estado del envio (web o app)
    |
    v
Trigger 1: sync_ecommerce_order_status --> Actualiza ecommerce_orders (interno)
Trigger 2: auto_sync_ml_status --> POST a mercadolibre-update-status (externo)
    |
    v
Edge Function consulta ml_status_mapping y actualiza la API de ML
    |
    v
MercadoLibre refleja el nuevo estado
```

### Mapeo de estados (ya configurado en ml_status_mapping)

| Estado interno | Estado ML | Sub-estado ML |
|---|---|---|
| pendiente | ready_to_ship | - |
| recogido | shipped | picked_up |
| en_sucursal | shipped | picked_up |
| en_transito | shipped | in_transit |
| en_reparto | shipped | out_for_delivery |
| entregado | delivered | - |
| no_entregado | not_delivered | receiver_absent |
| devuelto | returned | - |
| cancelado | cancelled | - |

---

## Resumen de archivos

| Archivo | Accion |
|---|---|
| Migracion SQL | Columnas ml_shipment_id/ml_tracking_number en ecommerce_orders + trigger auto_sync_ml_status |
| `supabase/functions/mercadolibre-sync/index.ts` | Usar tracking ML, guardar columnas nuevas |
| `supabase/functions/register-ml-shipment/index.ts` | Usar ML-{id} como tracking principal |
| `supabase/functions/mercadolibre-label/index.ts` | Nuevo: proxy para descargar etiqueta PDF |
| `src/pages/ecommerce/Orders.tsx` | Mostrar nro envio ML + boton etiqueta |
| `src/components/ecommerce/OrderDetailsDialog.tsx` | Seccion ML con QR, tracking y etiqueta |

## Sin dependencias nuevas

Se usa `qrcode.react` (ya instalada), `jsPDF` no es necesario, y `pg_net` es una extension nativa de Supabase.
