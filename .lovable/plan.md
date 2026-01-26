
# Plan: Corregir Desfase de Fechas en Toda la App

## Diagnóstico del Problema

El sistema muestra **"25/01/2026"** cuando la fecha real es **"26/01/2026"**. Esto ocurre porque:

1. **La base de datos almacena timestamps en UTC** (ej: `2026-01-26T02:00:00Z`)
2. **Al parsear con `new Date(string)`** en Argentina (UTC-3), se convierte a hora local
3. **Si el timestamp es temprano en UTC** (ej: 02:00 UTC = 23:00 del día anterior en Argentina), la fecha cambia

### Ejemplo del Bug
```
Base de datos: 2026-01-26T02:00:00Z (UTC)
Argentina:     2026-01-25T23:00:00 (UTC-3) ← ¡Día anterior!
```

## Solución Propuesta

Crear una **función helper centralizada** que extraiga la fecha sin conversión timezone, y usarla en todos los lugares que muestran fechas de la base de datos.

### Helper Functions (nuevo archivo)

```typescript
// src/lib/dateUtils.ts

/**
 * Parsea una fecha ISO string preservando la fecha original (sin shift de timezone)
 * Útil para campos tipo DATE o cuando solo importa el día, no la hora
 */
export function parseDateString(dateStr: string): Date {
  // Para fechas YYYY-MM-DD
  if (dateStr.length === 10 && dateStr.includes('-')) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // Para timestamps ISO, extraer solo la parte de fecha
  const datePart = dateStr.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Formatea una fecha Date a string YYYY-MM-DD sin conversión UTC
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Obtiene la fecha de hoy en formato YYYY-MM-DD (hora local)
 */
export function getTodayString(): string {
  return formatDateString(new Date());
}
```

## Archivos a Modificar

| Archivo | Problema | Solución |
|---------|----------|----------|
| `src/lib/dateUtils.ts` | No existe | **Crear** con helpers |
| `src/pages/PrintRouteSheet.tsx` | `new Date(hojaRuta.created_at)` | Usar `parseDateString()` |
| `src/pages/PrintPlannedRoute.tsx` | `new Date(ruta.fecha)` | Usar `parseDateString()` |
| `src/pages/Shipments.tsx` | `new Date(envio.created_at)` | Usar `parseDateString()` |
| `src/pages/Dashboard.tsx` | `toISOString().split('T')[0]` | Usar `getTodayString()` |
| `src/pages/ecommerce/Orders.tsx` | `new Date(order.created_at)` | Usar `parseDateString()` |
| `src/pages/MyRoutes.tsx` | `new Date(hoja.created_at)` | Usar `parseDateString()` |
| `src/components/mobile/MobileHomeTab.tsx` | `toISOString().split('T')[0]` | Usar `getTodayString()` |
| `src/components/mobile/MobileRoutesTab.tsx` | Si tiene fechas | Revisar y corregir |
| `src/components/routes/RescheduledShipmentsList.tsx` | `new Date(envio.fecha_entrega)` | Usar `parseDateString()` |
| `src/components/driver/RescheduleDialog.tsx` | `new Date(shipment.fecha_entrega)` | Usar `parseDateString()` |
| `src/pages/RoutePlanner.tsx` | Display de fechas en tab "Activas" | Usar `parseDateString()` |

## Cambios Detallados

### 1. Crear `src/lib/dateUtils.ts`
Archivo nuevo con los 3 helpers descritos arriba.

### 2. PrintRouteSheet.tsx (línea 136)
```typescript
// Antes
format(new Date(hojaRuta.created_at), "dd/MM/yyyy HH:mm", { locale: es })

// Después
import { parseDateString } from '@/lib/dateUtils';
format(parseDateString(hojaRuta.created_at), "dd/MM/yyyy", { locale: es })
```

### 3. PrintPlannedRoute.tsx (línea 145)
```typescript
// Antes
format(new Date(ruta.fecha), "EEEE dd/MM/yyyy", { locale: es })

// Después
import { parseDateString } from '@/lib/dateUtils';
format(parseDateString(ruta.fecha), "EEEE dd/MM/yyyy", { locale: es })
```

### 4. Dashboard.tsx (líneas 22 y 91)
```typescript
// Antes
const today = new Date().toISOString().split('T')[0];

// Después
import { getTodayString } from '@/lib/dateUtils';
const today = getTodayString();
```

### 5. Shipments.tsx (línea 343)
```typescript
// Antes
format(new Date(envio.created_at), 'dd MMM yyyy', { locale: es })

// Después
import { parseDateString } from '@/lib/dateUtils';
format(parseDateString(envio.created_at), 'dd MMM yyyy', { locale: es })
```

### 6. Orders.tsx (línea 244)
```typescript
// Antes
format(new Date(order.created_at), 'dd/MM/yy HH:mm', { locale: es })

// Después
import { parseDateString } from '@/lib/dateUtils';
format(parseDateString(order.created_at), 'dd/MM/yy', { locale: es })
```

### 7. MobileHomeTab.tsx (línea 64)
```typescript
// Antes
const today = new Date().toISOString().split('T')[0];

// Después
import { getTodayString } from '@/lib/dateUtils';
const today = getTodayString();
```

### 8. MyRoutes.tsx (líneas 262 y 364)
```typescript
// Antes
format(new Date(hoja.created_at), 'dd/MM/yy HH:mm', { locale: es })
format(new Date(ruta.fecha), 'dd/MM/yy', { locale: es })

// Después
import { parseDateString } from '@/lib/dateUtils';
format(parseDateString(hoja.created_at), 'dd/MM/yy', { locale: es })
format(parseDateString(ruta.fecha), 'dd/MM/yy', { locale: es })
```

### 9. RescheduledShipmentsList.tsx (líneas 172 y 177)
```typescript
// Antes
format(new Date(envio.fecha_entrega), 'dd/MM/yyyy', { locale: es })
format(new Date(envio.ultima_reprogramacion), 'dd/MM HH:mm', { locale: es })

// Después
import { parseDateString } from '@/lib/dateUtils';
format(parseDateString(envio.fecha_entrega), 'dd/MM/yyyy', { locale: es })
// Para ultima_reprogramacion mantener new Date() si necesita hora exacta
```

### 10. RescheduleDialog.tsx (línea 158)
```typescript
// Antes
format(new Date(shipment.fecha_entrega), 'dd/MM/yyyy', { locale: es })

// Después
import { parseDateString } from '@/lib/dateUtils';
format(parseDateString(shipment.fecha_entrega), 'dd/MM/yyyy', { locale: es })
```

## Nota sobre Horas

Para campos donde **sí importa la hora** (como `ultima_reprogramacion` o logs de actividad), se debe:
- Mantener `new Date()` para parsear
- Pero considerar que la hora mostrada será la local del usuario (que es lo esperado)

Para campos donde **solo importa la fecha** (como `fecha`, `fecha_entrega`, `created_at` cuando se muestra sin hora), usar `parseDateString()`.

## Resultado Esperado

- Las fechas se mostrarán correctamente en la zona horaria del usuario
- La hoja de ruta mostrará "26/01/2026" cuando la ruta es del día 26
- El dashboard filtrará correctamente los envíos "de hoy"
- Los listados de envíos mostrarán la fecha correcta de creación
