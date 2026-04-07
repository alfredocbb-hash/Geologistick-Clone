

## Plan: Fix envíos OCR no visibles en el Planificador

### Problema encontrado
En `RoutePlanner.tsx` línea 278 hay un filtro que **oculta todos los envíos que tienen `ml_shipment_id` y están en estado `pendiente`**:

```
if (envio.ml_shipment_id && envio.estado === 'pendiente') return false;
```

Este filtro existe para ocultar envíos de Mercado Libre que aún no fueron recolectados. Pero cuando se importan imágenes con OCR, el sistema detecta el ID de ML en la etiqueta y lo guarda en `ml_shipment_id` (línea 247 de BulkOCRScreen). Esos envíos se crean con estado `pendiente`, y el filtro los oculta del planificador.

De las 40 imágenes, las que tenían un número de ML detectado por la IA quedan invisibles.

### Solución
Agregar una excepción al filtro: si el envío fue creado manualmente (via OCR o importación), no ocultarlo. Usar el campo `source_module` para distinguir.

### Cambio en `src/pages/RoutePlanner.tsx`

**Línea 278**: Cambiar la condición de:
```typescript
if (envio.ml_shipment_id && envio.estado === 'pendiente') return false;
```
A:
```typescript
if (envio.ml_shipment_id && envio.estado === 'pendiente' 
    && !envio.source_module?.startsWith('bulk_ocr') 
    && envio.source_module !== 'flex_mixto'
    && envio.source_module !== 'third_party') return false;
```

Esto mantiene el filtro original para envíos sincronizados de ML, pero permite ver los creados manualmente por OCR, flex mixto o terciarizados.

### Archivos a modificar
- `src/pages/RoutePlanner.tsx` — Ajustar filtro de ML pendientes (1 línea)

