

# Fix: Filtrado de envíos en liquidaciones de sucursal según tipo_liquidacion

## Problema

Las liquidaciones de sucursal siempre filtran por `created_at`. La sucursal tiene un campo `tipo_liquidacion` que determina la lógica:
- **Inmediata** → filtrar por `created_at` (fecha de creación)
- **Diferida** → filtrar por `fecha_entrega` (fecha de entrega)

Actualmente este campo se ignora en el cálculo.

## Cambios

**Archivo:** `src/pages/BranchSettlements.tsx`

### 1. Obtener `tipo_liquidacion` de la sucursal
En el query de configuración de sucursal (línea ~163), agregar `tipo_liquidacion` al select:
```typescript
.select('incluye_iva, porcentaje_iva, tipo_liquidacion')
```

### 2. Cambiar el filtro de fechas según el tipo
Reemplazar las líneas 185-186 con lógica condicional:
```typescript
const dateField = sucursalConfig.tipo_liquidacion === 'inmediata' ? 'created_at' : 'fecha_entrega';

// En el query de envíos:
.gte(dateField, toLocalISOStart(fechaInicio))
.lte(dateField, toLocalISOEnd(fechaFin))
```

### 3. Importar utilidades de fecha
Agregar import de `toLocalISOStart` y `toLocalISOEnd` desde `@/lib/dateUtils`.

### 4. Mostrar tipo de liquidación en la UI
Agregar una indicación visual junto al selector de sucursal que muestre si la sucursal seleccionada es "Inmediata" o "Diferida", y actualizar los labels de fecha para que reflejen qué se está filtrando ("Fecha creación" vs "Fecha entrega").

