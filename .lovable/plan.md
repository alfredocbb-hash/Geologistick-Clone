

## Plan: Importar fotos con OCR en MobileScanTab (chofer) y ThirdPartyShipmentsTab (admin)

### Cambios

**1. `src/components/mobile/MobileScanTab.tsx`** — Agregar botón "Importar Fotos" en Quick Actions:
- Nuevo estado `showBulkOCR`
- Agregar una Card en la grilla de Quick Actions con icono de imagen/cámara y texto "Importar Fotos"
- Al tocar, abre `BulkOCRScreen` como overlay
- Al cerrar o completar, invalida queries de envíos
- Disponible para todos los roles (chofer, operador, admin)

**2. `src/components/routes/ThirdPartyShipmentsTab.tsx`** — Agregar botón "Importar con IA" junto al formulario:
- Nuevo estado `showBulkOCR`
- Botón secundario en el CardHeader (al lado del título "Agregar Envío Terciarizado") con icono de cámara/IA
- Al tocar, abre `BulkOCRScreen` en un Dialog/overlay
- Los envíos creados por OCR se crean en la DB normalmente; la tabla de pendientes se refresca automáticamente vía invalidación de queries
- Import de `BulkOCRScreen` desde `@/components/mobile/BulkOCRScreen`

### Archivos a modificar
- `src/components/mobile/MobileScanTab.tsx` — Estado + Card + mount de BulkOCRScreen
- `src/components/routes/ThirdPartyShipmentsTab.tsx` — Estado + botón + mount de BulkOCRScreen

