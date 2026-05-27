# Soportar nuevos substatus de Reprogramación de MercadoLibre

## Contexto

La API de ML ahora expone dos substatus específicos para reprogramación dentro de `status = shipped`:

- `rescheduled_by_meli` — Reprogramado por MercadoLibre (logística/operativa de Meli)
- `rescheduled_by_buyer` — Reprogramado por el comprador (desde su app)

Hoy la tabla `ml_status_mapping` solo tiene `shipped + rescheduled → reprogramado`. Los otros dos fueron eliminados explícitamente en la migración `20260427230959` para evitar duplicados, y nunca se volvieron a agregar. Resultado:

- El webhook (`mercadolibre-webhook`) y la sync polling (`mercadolibre-sync`) reciben `substatus = rescheduled_by_meli` o `rescheduled_by_buyer`, no encuentran mapping exacto, caen al fallback "sin substatus" (`shipped` → `en_reparto`) y se pierde el matiz de reprogramación. El envío queda como "en reparto" cuando debería estar "reprogramado".
- En la UI de **Órdenes ML** (`OrderDetailsDialog`) y **Envíos** (`ShipmentDetailsDialog`, `Shipments.tsx`) no se muestra el substatus original de ML, solo nuestro `estado` interno. El operador no sabe quién reprogramó.
- El componente `MLShipmentHistorySection` ya tiene los labels listos, pero ese historial solo se ve abriendo el detalle del envío ML.

## Cambios

### 1. Migración: agregar mapping de substatus

Insertar en `ml_status_mapping` (estos dos faltan):

```text
shipped | rescheduled_by_meli  | reprogramado
shipped | rescheduled_by_buyer | reprogramado
```

Esto hace que el matching exacto en webhook/sync funcione y marque el envío como `reprogramado` (mismo estado interno que ya usamos).

### 2. Persistir el substatus original

Agregar columna `ml_substatus_actual TEXT` en `envios` (nullable) — guarda el último substatus crudo recibido de ML. Lo escriben:

- `mercadolibre-webhook/index.ts` — al actualizar el envío, también guardar `ml_substatus_actual = shipment.substatus`.
- `mercadolibre-sync/index.ts` — idem cuando trae el shipment.
- `mercadolibre-update-status/index.ts` — al sincronizar outbound, persistir el `mapping.ml_substatus`.

Sin esto no podemos diferenciar "reprogramado por chofer" vs "reprogramado por comprador" vs "reprogramado por ML" en listados.

### 3. UI: badge de substatus reprogramado

Crear `src/components/ecommerce/MLSubstatusBadge.tsx` que reciba `ml_substatus_actual` y renderice un badge amarillo con el label legible (reutilizar el diccionario que ya existe en `MLShipmentHistorySection`, moverlo a `src/lib/mlSubstatusLabels.ts`).

Mostrarlo en:

- **Órdenes ML** — `src/pages/ecommerce/Orders.tsx` (columna de estado) y `OrderDetailsDialog.tsx`.
- **Envíos** — `src/pages/Shipments.tsx` (columna de estado, al lado del badge de estado interno) y `ShipmentDetailsDialog.tsx`.

Solo se muestra si `ml_shipment_id IS NOT NULL` y `ml_substatus_actual` está en el set de substatus relevantes (`rescheduled`, `rescheduled_by_meli`, `rescheduled_by_buyer`, `receiver_absent`, `second_visit`, `returning_to_hub`).

### 4. Historial ML — sin cambios de código

`MLShipmentHistorySection` ya tiene los labels. Confirmar que sigue funcionando contra `/shipments/{id}/history` de ML.

## Detalles técnicos

- La migración solo hace `INSERT ... ON CONFLICT DO NOTHING` en `ml_status_mapping` y `ALTER TABLE envios ADD COLUMN IF NOT EXISTS ml_substatus_actual TEXT`. No toca políticas RLS ni GRANTs (la tabla ya está expuesta).
- El campo `ml_substatus_actual` se considera dato denormalizado/cache — no se valida en triggers, solo se sobrescribe.
- El nuevo archivo `src/lib/mlSubstatusLabels.ts` exporta `ML_SUBSTATUS_LABELS` y un helper `isReprogramadoSubstatus(s)`. `MLShipmentHistorySection.tsx` pasa a importarlo (eliminar el duplicado local).
- No se cambia el enum `shipment_status` ni la lógica de `reschedule_envio` (siguen siendo válidos).

## Archivos afectados

- Nueva migración SQL (mapping + columna)
- `supabase/functions/mercadolibre-webhook/index.ts`
- `supabase/functions/mercadolibre-sync/index.ts`
- `supabase/functions/mercadolibre-update-status/index.ts`
- `src/lib/mlSubstatusLabels.ts` (nuevo)
- `src/components/ecommerce/MLSubstatusBadge.tsx` (nuevo)
- `src/components/ecommerce/MLShipmentHistorySection.tsx` (usar el módulo compartido)
- `src/pages/ecommerce/Orders.tsx`
- `src/components/ecommerce/OrderDetailsDialog.tsx`
- `src/pages/Shipments.tsx`
- `src/components/shipments/ShipmentDetailsDialog.tsx`

## Verificación

1. Forzar un webhook ML simulando `substatus = rescheduled_by_meli` → el envío queda `estado = reprogramado` y `ml_substatus_actual = rescheduled_by_meli`.
2. Abrir Envíos y Órdenes ML → ver el badge amarillo "Reprogramado por ML / por comprador".
3. El historial ML ya existente sigue mostrando los eventos correctamente.
