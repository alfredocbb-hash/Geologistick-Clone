# Sincronización de reprogramaciones con Mercado Libre

## Diagnóstico

Hoy, cuando reprogramás un envío (desde APK o admin), pasa esto:

1. El RPC `reschedule_envio` cambia el `estado` interno a **`pendiente`**.
2. El trigger `auto_sync_ml_status` dispara la edge function `mercadolibre-update-status`.
3. La edge function busca el mapeo de `pendiente` → ML lo recibe como **`ready_to_ship`** ("listo para despachar de bodega").
4. ML **rechaza** la transición porque no permite retroceder de `shipped/out_for_delivery` a `ready_to_ship` → queda `ml_sync_status = 'error'` y el envío en ML se queda con el estado anterior.

Resultado: **la reprogramación no se refleja en Mercado Libre.**

Detalle adicional: en la tabla `ml_status_mapping` ya existe el mapeo correcto para el estado interno `reprogramado` → `shipped` + substatus `rescheduled` / `rescheduled_by_meli` / `rescheduled_by_buyer`. Pero ese estado interno nunca se aplica al envío (solo se aplica a la parada de ruta).

## Cambios propuestos

### 1. Diferenciar el flujo para envíos de Mercado Libre en `reschedule_envio`
Modificar el RPC para que:
- Si el envío tiene `ml_shipment_id` (es de ML): setear `estado = 'reprogramado'` en lugar de `'pendiente'`.
- Si no es de ML: mantener el comportamiento actual (`estado = 'pendiente'`).
- En ambos casos seguir desasignando chofer, incrementando `reprogramado_count` y marcando la parada como `reprogramado`.

Esto hace que el trigger sincronice con ML usando `shipped` + `rescheduled`, que SÍ es una transición aceptada por ML desde `out_for_delivery`.

### 2. Limpiar entradas duplicadas en `ml_status_mapping`
Hoy `reprogramado` tiene 3 filas (con substatus `rescheduled`, `rescheduled_by_meli`, `rescheduled_by_buyer`). La edge function hace `.single()` y va a fallar con múltiples filas. Dejar **una sola** fila canónica:
- `reprogramado` → `shipped` + `rescheduled`

(Las otras dos quedan disponibles solo para el flujo inverso de webhook ML→interno, que usa otra lógica.)

### 3. Permitir reprogramar también envíos en estado `pendiente`/`en_sucursal`
Hoy el flujo asume que el envío estaba `en_reparto`. Ajustar para que la lógica de cambio de estado a `reprogramado` solo se aplique si el estado anterior era `en_reparto`, `primera_visita` o `segunda_visita`. Si estaba en otro estado, mantener `pendiente`.

### 4. Mejorar el manejo de errores de la edge function
En `mercadolibre-update-status`, cuando ML rechaza la transición (status 4xx con `error_code`), guardar el detalle en una nueva columna o en el campo existente para que el admin pueda ver por qué falló desde la UI. Actualmente solo queda `ml_sync_status = 'error'` sin más info accesible.

### 5. Mostrar el estado de sincronización en el detalle del envío
En la pantalla de detalle del envío (admin), mostrar un badge claro:
- ✓ Sincronizado con ML
- ⚠ Error de sincronización + tooltip con el motivo
- ⏳ Pendiente de sincronización

## Archivos afectados

- **Migración SQL**: modificar el RPC `reschedule_envio` y limpiar `ml_status_mapping`.
- **`supabase/functions/mercadolibre-update-status/index.ts`**: guardar detalle del error de ML en el envío.
- **Componente de detalle de envío** (admin): mostrar badge de estado de sync.

## Lo que NO cambia

- El flujo de reprogramación para envíos no-ML sigue idéntico (queda en `pendiente`).
- La APK y el admin siguen llamando al mismo RPC `reschedule_envio` — no hace falta tocar frontend ahí.
- El webhook entrante de ML (`mercadolibre-webhook`) no se modifica.

## Resultado esperado

Al reprogramar un envío de Mercado Libre:
- El envío queda en estado interno `reprogramado` (visible en historial).
- ML recibe `shipped` + `rescheduled` → el comprador ve "Visita reprogramada" en su app de ML.
- Si ML rechaza la transición por algún motivo, el admin lo ve con el detalle exacto.
