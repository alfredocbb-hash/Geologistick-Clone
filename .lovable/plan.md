## Contexto

El envío **ML-47149217113** (id `e0f0726f-391f-438c-a685-e9e3914738ca`, seller ABRAHAM ARDEBACO) figura como `en_reparto` en nuestro sistema, pero en Mercado Libre fue **cancelado por el comprador el 27/05/2026 13:11 (Arg)**. El chofer ve "cancelado" en la app de ML porque es la realidad. Hay que sincronizar nuestro registro y entender por qué no se actualizó solo.

## Qué voy a hacer

### 1. Corregir el envío puntual

- Actualizar `envios` (id `e0f0726f-…`):
  - `estado = 'cancelado'`
  - `estado_ml = 'cancelled'`
  - `ml_substatus_actual = NULL`
  - `ml_sync_status = 'synced'`
  - `ml_last_sync_at = now()`
  - `chofer_id = NULL` y `chofer_ultima_milla_id = NULL` (sacarlo de la ruta del chofer)
- Actualizar `ecommerce_orders` ligada: `ml_shipping_status = 'cancelled'`, `fulfillment_status = 'cancelled'`.
- Marcar la parada de ruta correspondiente (`ruta_paradas`) como `cancelada` con nota "Cancelado por comprador en Mercado Libre el 27/05/2026".
- Insertar entrada en `envio_historial`: `en_reparto → cancelado`, nota "Cancelado por el comprador en Mercado Libre (sincronización manual posterior). Fecha cancel ML: 27/05/2026 13:11".
- Si el envío tenía cargos en `seller_cuenta_corriente` por este tracking, **no tocarlos** (el flete sigue corriendo); se lo informo al usuario y, si quiere, hago un segundo paso de ajuste.

### 2. Investigar la causa raíz (sin tocar código aún)

Revisar:
- Logs de la edge function `mercadolibre-webhook` alrededor del 27/05 13:11 para ver si llegó la notificación de cancelación de este shipment y por qué no la procesó (firma HMAC, mapping de `cancelled`, etc.).
- Revisar `ml_status_mapping` para confirmar que existe la fila `ml_status='cancelled' / ml_substatus=NULL → estado_interno='cancelado'`.
- Revisar la función `mercadolibre-sync`/`auto_sync_ml_status` para entender por qué un sync posterior (28/05 12:29) volvió a aplicar `shipped → en_reparto` en lugar de leer el estado real `cancelled`.

Una vez tenga el diagnóstico, te lo paso y decidimos si hace falta parche en webhook/sync (lo haría en un plan aparte para no mezclar la corrección puntual con un cambio de lógica).

## Lo que **no** hago en este plan

- No modifico la lógica del webhook ni de las funciones de sync todavía (primero diagnóstico).
- No toco pagos ni cuenta corriente del seller sin tu confirmación.
- No cancelo ningún otro envío del seller — solo este.

## Verificación final

Re-consulto el envío y confirmo: `estado = cancelado`, sin chofer asignado, historial con la nota de cancelación ML, parada de ruta marcada como cancelada y `ecommerce_orders.ml_shipping_status = 'cancelled'`.
