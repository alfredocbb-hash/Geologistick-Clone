
# Plan: Eliminar Duplicación del Flete en Resumen de Precio

## Diagnóstico

El resumen muestra **dos líneas de Flete**:
- **Flete (CABA Y GBA) - $0.00**: Es el precio base de la tarifa (correcto)
- **Flete - $7,000.00**: Es un concepto llamado "Flete" que está **desactivado** (`activo: false`) pero aún se muestra

### Causa del Problema

La query que obtiene los precios de conceptos **no filtra por conceptos activos**:

```tsx
// Línea 296-299 - Falta filtrar por activo
.select('*, concepto:tarifa_conceptos(id, nombre, codigo, es_basico)')
.eq('tarifa_id', formData.tarifa_id);
// No hay .eq('concepto.activo', true)
```

---

## Solución

### Cambio 1: Filtrar conceptos inactivos en la clasificación

Modificar el `useMemo` que clasifica conceptos para excluir aquellos donde el concepto esté inactivo:

```tsx
// En la clasificación de conceptos básicos (línea 317)
const basicos = filtradosPorServicio.filter(cp => {
  // Excluir conceptos inactivos
  if (cp.concepto?.activo === false) return false;
  return cp.concepto?.es_basico !== false;
});
```

### Cambio 2: Agregar campo `activo` a la query

Modificar la query de `tarifa_concepto_precios` para incluir el campo `activo`:

```tsx
// Línea 298
.select('*, concepto:tarifa_conceptos(id, nombre, codigo, es_basico, activo)')
```

### Cambio 3: Actualizar la interface TypeScript

Agregar el campo `activo` a la interface del concepto para evitar errores de tipo.

---

## Resumen de Cambios

| Archivo | Línea | Cambio |
|---------|-------|--------|
| `src/pages/NewShipment.tsx` | ~298 | Agregar `activo` al select del JOIN |
| `src/pages/NewShipment.tsx` | ~317 | Filtrar conceptos donde `activo === false` |
| `src/pages/NewShipment.tsx` | ~321-324 | Mismo filtro para conceptos adicionales |

---

## Resultado Esperado

El resumen de precio mostrará:
- **Flete (CABA Y GBA)** - Precio base de la tarifa
- **Entrega a Domicilio** - $5,600.00
- **Seguro** (5% de $5,000.00) - $250.00
- **Distancia estimada** - 33.3 km

Sin duplicar la línea "Flete" del concepto desactivado.
