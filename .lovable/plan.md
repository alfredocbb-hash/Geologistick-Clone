## Objetivo

En **Liquidaciones de Seller**, agregar la opción de que el **"Desde"** del rango sea interpretado como la **fecha real en que el envío salió a reparto** (registrada por el webhook de MercadoLibre como `out_for_delivery` → `estado='en_reparto'`). El **"Hasta"** mantiene la lógica actual sin cambios.

## UX

En el panel de filtros de cálculo, sobre el date picker "Desde", agregar un selector pequeño:

**"Filtro Desde"**
- `Fecha de reparto estimada` (default — comportamiento actual)
- `Fecha real de salida a reparto (ML webhook)` (nuevo)

El selector de "Hasta" no cambia y sigue aplicando sobre las mismas columnas de fecha que hoy (`fecha_entrega_estimada`, `fecha_entrega`, `created_at`).

## Lógica

Cuando se elige **"Fecha real de salida a reparto"** para el Desde:

1. Antes de armar la lista de envíos, consultar `envio_historial`:
   - `estado_nuevo = 'en_reparto'`
   - `created_at >= fechaInicio` (sin tope superior — el tope lo aplican luego los filtros existentes del "Hasta" sobre las columnas de envío).
   - Defensivo: `ubicacion ilike '%ML Webhook%'` OR `notas ilike '%out_for_delivery%'` para asegurar que sea el webhook ML y no un cambio manual.
   - Conservar el primer evento por `envio_id`.
   - Resultado: `Set<envio_id>` que cumplen "salieron a reparto desde X en adelante".

2. En las queries de envíos:
   - **ecommerce_orders**: quitar el `.gte('fecha_entrega_estimada', fechaInicioStr)` y agregar `.in('envio_id', [...set])`. Mantener el `.lte('fecha_entrega_estimada', fechaFinStr)` para el tope Hasta.
   - **envios comunes (con `fecha_entrega`)**: quitar `.gte('fecha_entrega', fechaInicioStr)` y agregar `.in('id', [...set])`. Mantener el `.lte('fecha_entrega', fechaFinStr)`.
   - **envios comunes sin `fecha_entrega`** (rama que filtra por `created_at`): cuando el modo es webhook, esta rama no aplica (los envíos elegibles ya están acotados por el `envio_historial`); se omite para evitar mezclar criterios.
   - **seller_cuenta_corriente** (movimientos manuales y cargos cta cte): se mantiene el filtro por `created_at` (no tiene fecha de webhook).

3. Si el set del paso 1 está vacío, las queries de envíos devuelven vacío (solo quedan movimientos cta cte si los hay).

## Persistencia

El modo elegido vive en el estado local del componente. La liquidación generada sigue grabando `periodo_inicio` / `periodo_fin` como hoy.

## Archivos a modificar

- `src/pages/ecommerce/Settlements.tsx`
  - Nuevo estado `tipoFechaDesde: 'estimada' | 'webhook_reparto'`.
  - `<Select>` arriba/al lado del date picker "Desde" (~líneas 1500-1520).
  - En `calculateMutation.mutationFn` (líneas 466-620): si `tipoFechaDesde === 'webhook_reparto'`, query previa a `envio_historial` y ajuste de los `.gte` / `.in` descrito arriba.

## Validación

- Modo default: resultado idéntico al actual.
- Modo webhook: con un rango cuyo Desde sea anterior a la fecha del webhook ML del ejemplo (ML-4734391416 9 → 23/06 11:27), el envío aparece; con un Desde posterior, no aparece.
- Rango sin eventos `en_reparto` en el modo webhook: no se devuelven envíos.
