

# Diagnóstico: Comisiones de Berazategui aparecen en 0 en el diálogo pero funcionan en liquidaciones

## Hallazgo

Las comisiones de Berazategui están guardadas en `sucursal_comisiones` con **concept IDs de otros tenants**:

| Concepto | ID en sucursal_comisiones | Tenant del concepto | Valor real |
|----------|--------------------------|---------------------|------------|
| Flete | `1cd05d8a-...` | `a0000000-...` (tenant demo) | 25% |
| Seguro | `d5878656-...` | `a0000000-...` (tenant demo) | 1% |
| Entrega | `0663154f-...` | `a0000000-...` (tenant demo) | 100% |
| Serv. Agencia | `ea409ae2-...` | `94a9ea85-...` (otro tenant) | 100% |

Pero los conceptos propios de Blackbox tienen **IDs diferentes**:

| Concepto | ID de Blackbox | Tenant |
|----------|----------------|--------|
| Flete | `bb000001-...-01` | `81be07a7-...` (Blackbox) |
| Seguro | `bb000001-...-02` | `81be07a7-...` (Blackbox) |
| Entrega | `bb000001-...-04` | `81be07a7-...` (Blackbox) |
| Serv. Agencia | `bb000001-...-05` | `81be07a7-...` (Blackbox) |

## Por qué el diálogo muestra 0

El diálogo de comisiones (Branches.tsx):
1. Carga conceptos filtrados por `tenant_id = Blackbox` → obtiene IDs `bb000001-*`
2. Busca en `sucursal_comisiones` por `concepto_id === concepto.id` → no encuentra match porque las comisiones guardadas usan IDs de otros tenants
3. Muestra todo en 0

## Por qué la liquidación funciona

BranchSettlements.tsx carga `sucursal_comisiones` directamente por `sucursal_id` sin filtrar por tenant de conceptos, y usa un fallback por nombre. Así encuentra las comisiones reales (25%, 100%, etc.) aunque los concept IDs sean de otros tenants.

## Solución

Dos cambios en `src/pages/Branches.tsx`:

### 1. Matching por nombre en la inicialización del diálogo

En el `useEffect` que inicializa las comisiones (línea 225), agregar fallback por nombre cuando no hay match por ID:

```typescript
const existing = sucursalComisiones.find(
  (c) => c.concepto_id === concepto.id && c.tipo_rol === 'emision'
) || sucursalComisiones.find(
  (c) => c.tipo_rol === 'emision' && 
    conceptoNombresMap[c.concepto_id]?.toLowerCase() === concepto.nombre.toLowerCase()
);
```

Esto requiere construir un mapa de nombres de los concept IDs que aparecen en `sucursal_comisiones`.

### 2. Migrar concept IDs al guardar

En `saveCommissionsMutation`, al hacer upsert, siempre usar los concept IDs del tenant actual (los `bb000001-*`). Esto normaliza la data para que futuras lecturas funcionen por ID directo.

### 3. Resolver conceptos huérfanos en la query de inicialización

Agregar una query auxiliar que traiga los nombres de los conceptos referenciados en `sucursal_comisiones` (que pueden ser de otros tenants), para poder hacer el matching por nombre.

| Archivo | Cambio |
|---------|--------|
| `src/pages/Branches.tsx` | Agregar query de nombres de conceptos referenciados, fallback por nombre en useEffect, migración de IDs al guardar |

