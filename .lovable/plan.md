
# Plan: Corrección de 3 Problemas Reportados

## Problema 1: Inputs de comisiones no permiten editar

### Causa Raíz
El `useEffect` que inicializa los datos de comisiones tiene `conceptosFiltrados` como dependencia. Como `conceptosFiltrados` se recalcula en **cada render** (porque `filter` siempre crea un nuevo array), el `useEffect` se ejecuta continuamente, sobrescribiendo los valores que el usuario intenta ingresar.

### Solución
Usar `useMemo` para memorizar `conceptosFiltrados` y evitar que cambie innecesariamente:

```typescript
const conceptosFiltrados = useMemo(() => 
  conceptos.filter(c => !['recepcion', 'cobros'].includes(c.codigo)),
  [conceptos]
);
```

---

## Problema 2: Insertar tarifa de MercadoLibre en envíos Flex

### Situación Actual
Cuando se registra un envío ML Flex via QR, el sistema usa la tarifa del seller (`seller.tarifa_id`) para calcular el precio, **ignorando** la tarifa que ML ya tiene definida para ese envío.

### Solución
Obtener el costo del envío desde la respuesta del API de MercadoLibre y guardarlo en el campo `precio_flete_ml`:

1. Extraer `mlShipment.shipping_option.cost` o `mlShipment.cost` de la respuesta del API
2. Agregar columna `precio_flete_ml` a la tabla `envios` (si no existe)
3. Guardar este valor junto con el envío para referencia

---

## Problema 3: Página OAuth muestra código en lugar de HTML

### Posible Causa
La función edge ya tiene el HTML correcto pero puede no estar desplegada correctamente o el navegador puede estar mostrando una respuesta JSON de una etapa anterior del proceso.

### Solución
Redesplegar la edge function para asegurar que el código actualizado esté en producción.

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/Branches.tsx` | Envolver `conceptosFiltrados` en `useMemo` |
| `supabase/functions/register-ml-shipment/index.ts` | Capturar y guardar `shipping_option.cost` de ML API |
| Nueva migración SQL | Agregar campo `precio_flete_ml` a tabla `envios` (si no existe) |
| `supabase/functions/mercadolibre-oauth/index.ts` | Redesplegar para asegurar HTML de éxito |

---

## Sección Tecnica

### Cambio 1: Memorizar conceptos filtrados

```typescript
// ANTES (línea ~207)
const conceptosFiltrados = conceptos.filter(
  c => !['recepcion', 'cobros'].includes(c.codigo)
);

// DESPUÉS
const conceptosFiltrados = useMemo(() => 
  conceptos.filter(c => !['recepcion', 'cobros'].includes(c.codigo)),
  [conceptos]
);
```

### Cambio 2: Capturar tarifa ML en registro de envíos

```typescript
// En register-ml-shipment/index.ts, después de obtener mlShipment:

// Extraer costo de envío de ML
const mlShippingCost = mlShipment.shipping_option?.cost 
  || mlShipment.cost 
  || mlShipment.base_cost 
  || 0;

console.log('[register-ml-shipment] ML shipping cost:', mlShippingCost);

// Al crear el envío, agregar el campo:
{
  // ... otros campos
  precio_flete_ml: mlShippingCost,
}
```

### Migración SQL (si el campo no existe)

```sql
ALTER TABLE envios 
ADD COLUMN IF NOT EXISTS precio_flete_ml numeric(10,2) DEFAULT 0;

COMMENT ON COLUMN envios.precio_flete_ml IS 
  'Costo de envío definido por MercadoLibre para envíos Flex';
```
