

## Plan: Mostrar nombres de concepto en vez de UUIDs en el desglose reconstruido

### Problema

Los conceptos aparecen como UUIDs (ej: `bb000001-0000-0000-0000-000000000001 (Emisión)`) porque:
- `desglose_conceptos` se guarda en la DB con la key `conceptoId::rol` (UUID)
- La función `rebuildResumenFromDetalles` usa esa key UUID como nombre de display

### Solución

**`src/pages/BranchSettlements.tsx`** — Al construir `enviosDesglose` (línea ~426), incluir el nombre del concepto en los valores almacenados:

```typescript
enviosDesglose[envioId][conceptoKey] = {
  venta: monto,
  porcentaje,
  comision,
  nombre: conceptoNombres[conceptoId || ''] || conceptoNombre, // AGREGAR
};
```

**`src/lib/rebuildResumenConceptos.ts`** — Actualizar la interfaz y lógica:

1. Ampliar el tipo de `desglose_conceptos` para incluir `nombre?: string`
2. En el loop, usar `values.nombre || baseName` como nombre base en vez del UUID raw
3. Esto hace que el display muestre "Flete (Emisión)" en vez de "bb000001-... (Emisión)"

### Para liquidaciones ya guardadas sin `nombre`

Fallback: si `values.nombre` no existe (datos viejos), se sigue usando el key como antes. Para esas liquidaciones antiguas se podría hacer un lookup a `conceptos_envio` por ID, pero eso requeriría una query adicional. Alternativamente, se puede agregar el nombre del concepto como campo en `liquidacion_sucursal_detalles` (ya existe `concepto_nombre` si lo hay).

Verificar si la tabla `liquidacion_sucursal_detalles` tiene un campo `concepto_nombre` o similar que se pueda usar como segundo fallback.

| Archivo | Cambio |
|---------|--------|
| `BranchSettlements.tsx` | Incluir `nombre` del concepto en `enviosDesglose` al guardarlo |
| `rebuildResumenConceptos.ts` | Usar `values.nombre` como nombre de display, con fallback al key |

