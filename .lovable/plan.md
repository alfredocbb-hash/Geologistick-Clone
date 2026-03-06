

# Mejoras: Select de sucursal con búsqueda + Tracking más corto y limpio

## Problemas
1. **Select de sucursal destino**: Sin búsqueda, difícil encontrar entre muchas sucursales. Además muestra el código que no aporta al usuario.
2. **Tracking number muy largo**: El formato actual `XXX-ENV-20260306-A1B2C3` tiene ~22 caracteres, difícil de copiar/dictar para el cliente final.

## Cambios

### 1. Select de sucursal con búsqueda (`src/pages/NewShipment.tsx`, líneas ~2217-2232)
- Reemplazar `<Select>` por `Popover` + `Command` (combobox searchable)
- Mostrar solo **nombre** y **dirección/ciudad** (sin código)
- Filtrar por nombre, ciudad o dirección al escribir
- Mostrar la sucursal seleccionada en el trigger

### 2. Tracking number más corto
**Migración SQL** — Actualizar `generate_tracking_number()`:
- Nuevo formato: `ENV-XXXXXX` (10 caracteres) usando 6 caracteres alfanuméricos aleatorios
- Mucho más fácil de copiar, dictar y compartir
- Se mantiene unicidad con el loop de verificación existente

### 3. Tracking page — Limpiar visualización (`src/pages/Tracking.tsx`)
- En la línea 222, quitar el estilo `font-mono` del tracking number
- Agregar botón "Copiar" junto al tracking para facilitar copiado

### Archivos a modificar
1. `src/pages/NewShipment.tsx` — combobox searchable para sucursal destino
2. `supabase/migrations/` — nueva migración para `generate_tracking_number()` con formato corto
3. `src/pages/Tracking.tsx` — botón copiar tracking

