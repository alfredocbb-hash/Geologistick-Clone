

# Plan: Corregir tracking y foto del chofer

## 1. Tracking: agregar estados faltantes

**Problema**: Los estados `incidencia` y `no_entregado` existen en la DB pero no están en el type `ShipmentStatus` ni en `statusConfig` de `Tracking.tsx` y `TrackingEmbed.tsx`. Si el envío tiene uno de esos estados, el badge no se renderiza correctamente y el progress bar queda vacío (index = -1).

**Solución en `src/pages/Tracking.tsx` y `src/pages/TrackingEmbed.tsx`**:
- Agregar `'incidencia' | 'no_entregado'` al type `ShipmentStatus`
- Agregar entradas en `statusConfig` para ambos estados
- Para el progress bar: cuando el estado no está en `statusOrder` (es un estado alternativo), calcular `currentStatusIndex` basado en el último estado "lineal" conocido del historial, o mostrar el progreso hasta el punto donde se desvió

## 2. Foto del chofer no carga (Android WebView)

**Problema**: En Android, `capture="environment"` abre la cámara nativa, lo cual puede causar que el WebView se recargue. Al volver, el `onChange` del input nunca se dispara y la foto se pierde.

**Solución en `src/components/delivery/DeliveryConfirmation.tsx` y `src/components/incidents/ReportIncidentDialog.tsx`**:
- Remover `capture="environment"` del input file. Con solo `accept="image/*"`, Android muestra un selector que incluye cámara Y galería, y es más estable porque no fuerza una app externa
- Agregar un segundo botón "Elegir de Galería" sin capture, para dar alternativa si la cámara falla
- Mantener el flujo de sessionStorage como fallback

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `src/pages/Tracking.tsx` | Agregar `incidencia`, `no_entregado` al type y statusConfig; fix progress para estados alternativos |
| `src/pages/TrackingEmbed.tsx` | Mismo cambio |
| `src/components/delivery/DeliveryConfirmation.tsx` | Remover `capture="environment"`, agregar opción galería |
| `src/components/incidents/ReportIncidentDialog.tsx` | Remover `capture="environment"`, agregar opción galería |

