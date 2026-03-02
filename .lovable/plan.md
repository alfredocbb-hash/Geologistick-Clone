

# Agregar estados "Primera Visita", "Segunda Visita" y "Reprogramado" al sistema

## Situacion actual

El enum `shipment_status` tiene 11 valores: `pendiente`, `recogido`, `en_sucursal`, `en_bodega`, `en_transito`, `en_reparto`, `entregado`, `devuelto`, `cancelado`, `incidencia`, `no_entregado`.

Faltan estados que ML usa frecuentemente y que el sistema necesita representar internamente: **primera_visita**, **segunda_visita** y **reprogramado**.

Actualmente, cuando ML reporta `shipped/rescheduled` o `not_delivered/second_visit`, el mapeo los envía a `en_transito` o `en_reparto`, perdiendo la información específica del sub-estado.

## Cambios

### 1. Base de datos (SQL Migration)

Agregar 3 nuevos valores al enum `shipment_status`:

```sql
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'primera_visita';
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'segunda_visita';
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'reprogramado';
```

Actualizar `ml_status_mapping` para que estos sub-estados de ML se mapeen a los nuevos estados internos:

```sql
UPDATE ml_status_mapping 
SET estado_interno = 'reprogramado' 
WHERE ml_status = 'shipped' AND ml_substatus = 'rescheduled';

UPDATE ml_status_mapping 
SET estado_interno = 'reprogramado' 
WHERE ml_status = 'shipped' AND ml_substatus = 'rescheduled_by_meli';

INSERT INTO ml_status_mapping (ml_status, ml_substatus, estado_interno, descripcion)
VALUES 
  ('shipped', 'rescheduled_by_buyer', 'reprogramado', 'Reprogramado por el comprador'),
  ('not_delivered', 'second_visit', 'segunda_visita', 'Segunda visita de entrega'),
  ('not_delivered', 'receiver_absent', 'primera_visita', 'Primera visita - destinatario ausente')
ON CONFLICT DO NOTHING;
```

### 2. UI - statusConfig en 6 archivos

Agregar los 3 nuevos estados a cada `statusConfig`:

| Estado | Label | Color | Icono |
|--------|-------|-------|-------|
| `primera_visita` | 1a Visita | `bg-amber-600` | `AlertCircle` |
| `segunda_visita` | 2a Visita | `bg-red-400` | `AlertCircle` |
| `reprogramado` | Reprogramado | `bg-indigo-500` | `CalendarClock` |

Archivos a modificar:
- `src/pages/Shipments.tsx`
- `src/pages/Tracking.tsx`
- `src/pages/TrackingEmbed.tsx`
- `src/components/shipments/ShipmentDetailsDialog.tsx`
- `src/components/shipments/ShipmentHistoryDialog.tsx`
- `src/components/shipments/ChangeStatusDialog.tsx`

### 3. Guia de estados (`src/pages/ShipmentStatusGuide.tsx`)

Agregar los 3 nuevos estados a `alternativeStatuses` para que aparezcan en la documentacion visual.

### 4. Flujo logico

Los nuevos estados se integran en el flujo existente:
- `en_reparto` -> `primera_visita` (destinatario ausente, 1er intento)
- `primera_visita` -> `segunda_visita` (2do intento fallido)
- `primera_visita` / `segunda_visita` -> `reprogramado` (se reprograma entrega)
- `reprogramado` -> `pendiente` o `en_reparto` (se reintenta)

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Base de datos (SQL) | Agregar 3 valores al enum + actualizar ml_status_mapping |
| `src/pages/Shipments.tsx` | Agregar 3 estados a statusConfig |
| `src/pages/Tracking.tsx` | Agregar 3 estados a statusConfig |
| `src/pages/TrackingEmbed.tsx` | Agregar 3 estados a statusConfig |
| `src/components/shipments/ShipmentDetailsDialog.tsx` | Agregar 3 estados a statusConfig |
| `src/components/shipments/ShipmentHistoryDialog.tsx` | Agregar 3 estados a statusConfig |
| `src/components/shipments/ChangeStatusDialog.tsx` | Agregar 3 estados a statusConfig + statusOrder |
| `src/pages/ShipmentStatusGuide.tsx` | Agregar a alternativeStatuses |

