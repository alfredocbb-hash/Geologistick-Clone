## Filtro por estado y totalizadores en Liquidaciones E-commerce

En `src/pages/ecommerce/Settlements.tsx`, dentro del card "Historial de Liquidaciones" (tab Liquidaciones), agregar:

### 1. Filtro por estado
Encima de la tabla, un `Select` con opciones:
- Todas
- Generada
- Aprobada
- Pagada
- Anulada / Cancelada (los estados existentes en `liquidaciones_seller.estado`)

Estado local `filterEstado` que filtra `liquidaciones` antes del `.map()`.

Adicional: un `Input` de búsqueda por seller (nombre) para acompañar el filtro, ya que es habitual al revisar por estado.

### 2. Totalizadores (cards arriba de la tabla)
Calculados sobre la lista **filtrada** (`filteredLiquidaciones`):

- **Cantidad** de liquidaciones
- **Total Cargos** (suma `total_cargos`)
- **Total Pagos** (suma `total_pagos`)
- **Saldo Pendiente** (suma `saldo_periodo` de las que NO están en estado `pagada` ni `anulada`) — destacado en naranja
- **Total Pagado** (suma `total_pagos` de las `pagada`) — en verde

Cuando el usuario filtre por "Aprobada" verá inmediatamente cuánto hay pendiente de cobro; al filtrar por "Pagada" verá el total cobrado del período.

### 3. Detalles técnicos

- Sin cambios de DB; sólo UI sobre el `useQuery` ya existente (`seller-liquidaciones`).
- Usar `useMemo` para `filteredLiquidaciones` y los totales.
- Mantener el `colSpan` del empty state coherente.
- Reusar `getEstadoBadge` y mismos colores que ya se usan (orange/green) para consistencia visual.

### Archivos a modificar
- `src/pages/ecommerce/Settlements.tsx` (único archivo)
