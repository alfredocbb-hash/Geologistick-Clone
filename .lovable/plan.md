

# Mejoras: Select sucursal con búsqueda + Tracking corto + Botón copiar

## Cambios

### 1. Migración SQL — `generate_tracking_number()` más corto
Actualizar ambas versiones de la función (con y sin parámetro `p_sucursal_id`):
- **Sin parámetro**: formato `ENV-XXXXXX` (10 chars) con 6 caracteres alfanuméricos aleatorios (sin caracteres ambiguos O/0/I/1/L)
- **Con parámetro**: mismo formato `ENV-XXXXXX` (ya no incluye código de sucursal ni fecha para mantenerlo corto)
- Se mantiene el loop de unicidad existente

### 2. Edge Function `public-tracking` — Ajustar umbral de código corto
- Línea 117: cambiar threshold de `< 15` a `< 8` para que el nuevo formato `ENV-XXXXXX` (10 chars) pase la validación pública sin problema
- Los nuevos trackings de 10 chars serán aceptados como búsqueda pública

### 3. `src/pages/NewShipment.tsx` — Combobox searchable para sucursal destino
- Agregar imports de `Popover`, `PopoverTrigger`, `PopoverContent`, `Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandItem`
- Reemplazar el `<Select>` de sucursal destino (líneas 2217-2232) por un combobox con búsqueda
- Mostrar **nombre** y **dirección/ciudad** (sin código)
- Filtrar por nombre, ciudad o dirección
- Estado local `sucursalSearch` y `sucursalOpen`

### 4. `src/pages/Tracking.tsx` — Botón copiar + limpiar estilo
- Línea 222: quitar `font-mono`, agregar botón "Copiar" con icono `Copy` de lucide que copie el tracking al clipboard con feedback toast
- Importar `Copy` de lucide y `useToast`

### 5. `src/pages/TrackingEmbed.tsx` — Botón copiar
- Línea 202: agregar botón copiar junto al tracking number, mismo patrón que Tracking.tsx

## Archivos a modificar
1. **Nueva migración SQL** — actualizar `generate_tracking_number()` (ambas versiones)
2. **`supabase/functions/public-tracking/index.ts`** — threshold `< 8`
3. **`src/pages/NewShipment.tsx`** — combobox searchable
4. **`src/pages/Tracking.tsx`** — botón copiar + quitar font-mono
5. **`src/pages/TrackingEmbed.tsx`** — botón copiar

