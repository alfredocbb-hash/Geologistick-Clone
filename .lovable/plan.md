
# Plan: Corregir Fecha en Rutas Activas (Problema de Timezone)

## Problema Identificado

La ruta de Kevin Bernard (`RP-20260129-7761`) se guarda correctamente con fecha **2026-01-29** en la base de datos, pero se muestra como **28/01/2026** en la interfaz.

**Causa raíz:** 
En la línea 1359 de `RoutePlanner.tsx`, se usa `new Date(ruta.fecha)` directamente. Cuando JavaScript parsea una fecha en formato `YYYY-MM-DD`, la interpreta como medianoche UTC, y luego la convierte a hora local (Argentina = UTC-3), resultando en el día anterior.

```
Base de datos: "2026-01-29" (fecha correcta)
→ new Date("2026-01-29") → 2026-01-29T00:00:00Z (UTC)
→ En Argentina (UTC-3) → 2026-01-28T21:00:00 local ❌
```

## Solución

Usar la función `parseDateString` de `src/lib/dateUtils.ts` que ya existe en el proyecto y está diseñada exactamente para este problema. Esta función extrae los componentes de la fecha sin conversión de timezone.

## Cambio Técnico

| Archivo | Cambio |
|---------|--------|
| `src/pages/RoutePlanner.tsx` | Importar `parseDateString` de `@/lib/dateUtils` |
| | Línea 1359: Cambiar `new Date(ruta.fecha)` por `parseDateString(ruta.fecha)` |

### Código Actual (línea 1359):
```tsx
{format(new Date(ruta.fecha), "dd/MM/yyyy", { locale: es })}
```

### Código Corregido:
```tsx
{format(parseDateString(ruta.fecha), "dd/MM/yyyy", { locale: es })}
```

## Resultado Esperado

- La ruta `RP-20260129-7761` de Kevin Bernard mostrará **29/01/2026** (correcto)
- Todas las rutas activas mostrarán la fecha exacta guardada en la base de datos
- Consistencia con otras partes del sistema que ya usan `parseDateString`
