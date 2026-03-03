

# Auditoría: Envíos cancelados en Dashboard, Reportes y Caja

## Hallazgos

Revisé cómo se tratan los envíos cancelados en cada módulo:

### Dashboard (`src/pages/Dashboard.tsx`)

| Métrica | ¿Incluye cancelados? | Problema |
|---------|----------------------|----------|
| Envíos Hoy (línea 31-35) | **Sí** — cuenta todos los envíos creados hoy sin filtrar estado | **Sí** — infla el conteo |
| Ingresos del Día (línea 45-51) | **Sí** — suma `precio_total` de todos los envíos de hoy | **Sí** — suma ingresos de cancelados |
| En Tránsito (línea 38-42) | No — filtra por `en_transito`/`en_reparto` | OK |
| Entregas Completadas (línea 100-105) | No — filtra por `entregado` | OK |
| Pendientes (línea 108-112) | No — filtra por `pendiente` | OK |

### Reportes (`src/hooks/useReportsData.ts`)

| Métrica | ¿Incluye cancelados? | Problema |
|---------|----------------------|----------|
| Envíos por Sucursal — total (línea 56-76) | Sí, pero los clasifica correctamente en `cancelados` | OK — aparecen en columna "cancelados" |
| Destinos — ingresos (línea 96-101) | **Sí** — suma `precio_total` de cancelados | **Sí** — infla ingresos por destino |
| Rendimiento Choferes (línea 134-225) | Sí, los cuenta pero los clasifica como `no_entregados` | OK — penaliza efectividad correctamente |
| Resumen General — ingresosTotales (línea 251) | **Sí** — `envios.reduce(sum + precio_total)` sin excluir cancelados | **Sí** — infla ingresos totales |
| Resumen General — tasaEntrega (línea 250) | Incluye cancelados en denominador | OK — es correcto, baja la tasa |

### Caja (`src/pages/Cash.tsx`)

No hay problema. Los movimientos de caja se registran individualmente y ya implementamos la compensación con egresos al cancelar.

### Ecommerce Dashboard (`src/pages/ecommerce/Dashboard.tsx`)

Habría que verificar si suma ingresos de pedidos cancelados — pero ese dashboard cuenta órdenes, no suma `precio_total` de envíos directamente.

## Solución

### 1. `src/pages/Dashboard.tsx` — Excluir cancelados de "Envíos Hoy" e "Ingresos del Día"

Agregar `.not('estado', 'in', '(cancelado,devuelto)')` a las queries de:
- **Envíos Hoy** (línea 31-35)
- **Ingresos del Día** (línea 45-49)

### 2. `src/hooks/useReportsData.ts` — Excluir cancelados de ingresos

- **Destinos** (línea ~97): Al sumar `ingresos`, excluir envíos con estado `cancelado` o `devuelto`
- **Resumen General** (línea 251): Al calcular `ingresosTotales`, excluir envíos cancelados/devueltos

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Dashboard.tsx` | Excluir `cancelado`/`devuelto` de conteo de envíos hoy e ingresos del día |
| `src/hooks/useReportsData.ts` | Excluir `cancelado`/`devuelto` del cálculo de ingresos en destinos y resumen general |

