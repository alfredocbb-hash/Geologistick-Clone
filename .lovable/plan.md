

## Plan: Asignar sucursal de origen a envíos creados por OCR

### Problema
Cuando se crea un envío por OCR (desde MobileScanTab, BulkOCRScreen, o FlexMixtoScreen), el envío no tiene `sucursal_origen_id` ni `sucursal_entrega_id`. Esto significa que el envío queda "flotando" sin estar vinculado a ninguna sucursal. No aparece en la lista de envíos pendientes de la sucursal, ni puede ser colectado por un chofer para planificar rutas.

### Solución
Al crear un envío por OCR, asignar automáticamente la sucursal del usuario como `sucursal_origen_id` y `sucursal_entrega_id` (ubicación física actual). Esto permite que:
1. El envío aparezca en la recepción de la sucursal
2. Un chofer pueda colectarlo desde esa sucursal
3. Se pueda planificar una ruta o transferir a otro chofer

### Cambios

**1. `src/components/mobile/MobileScanTab.tsx`** — En el `onConfirm` del OCRCaptureDialog, agregar `sucursal_origen_id` y `sucursal_entrega_id` desde `profile.sucursal_id` al insert de envíos.

**2. `src/components/mobile/BulkOCRScreen.tsx`** — Mismo fix: agregar `sucursal_origen_id` y `sucursal_entrega_id` al insert.

**3. `src/hooks/useFlexPackages.ts`** — En `addManualPackage`, agregar `sucursal_origen_id` y `sucursal_entrega_id` desde `profile.sucursal_id` al insert.

### Archivos a modificar
- `src/components/mobile/MobileScanTab.tsx`
- `src/components/mobile/BulkOCRScreen.tsx`
- `src/hooks/useFlexPackages.ts`

