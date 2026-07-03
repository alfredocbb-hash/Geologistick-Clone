## Objetivo
Replicar la lógica de "Historial de Liquidaciones eCommerce" para las liquidaciones de choferes: agregar filtros por fecha con KPIs, y sumarlo al módulo Finanzas.

## Cambios

### 1. `src/pages/DriverSettlements.tsx` — Historial con filtros
- Agregar estados `histDesde` / `histHasta` / `histTipoFecha` (`'periodo'` | `'pago'`) y `histEstado` / `histChoferSearch`.
- Modificar el useQuery `liquidaciones-choferes` para aceptar rango de fechas:
  - Si `histTipoFecha === 'pago'`: filtrar por `fecha_pago` gte/lte (usa `toLocalISOStart/End`).
  - Si `'periodo'`: `periodo_inicio >= desde` y `periodo_fin <= hasta`.
  - Subir el `.limit(50)` a `.limit(500)`.
- Filtrado en cliente por chofer (nombre/apellido) y estado.
- Barra de filtros arriba de la tabla del Historial (Desde, Hasta, Tipo de fecha, Estado, Búsqueda chofer, botón "Mes actual").
- KPIs sobre el conjunto filtrado: Cantidad, Total Pagado (`estado='pagada'`), Total Generado, Envíos totales.

### 2. `src/components/finanzas/LiquidacionesChoferesTab.tsx` (nuevo)
- Espejo de `LiquidacionesEcommerceTab.tsx`.
- Query a `liquidaciones` con `estado='pagada'`, join a `profiles` para nombre/apellido del chofer, filtrado por `fecha_pago` en el rango.
- KPIs: cantidad, total pagado, envíos.
- Tabla: Chofer, Período, Fecha de pago, Envíos, Monto, Estado.
- Link a `/driver-settlements`.

### 3. `src/pages/Finanzas.tsx`
- Agregar tercer `<TabsTrigger value="choferes">Liquidaciones Choferes</TabsTrigger>` + `<TabsContent>` con el nuevo componente.

## Notas técnicas
- Reusar `parseDateString`, `toLocalISOStart`, `toLocalISOEnd` de `@/lib/dateUtils`.
- `liquidaciones` no tiene FK directa a `profiles`; se sigue el patrón actual de hacer un segundo query `.in('user_id', choferIds)`.
- El default del rango en el Historial y en Finanzas será el mes actual (`startOfMonth`/`endOfMonth`), igual que en eCommerce.
