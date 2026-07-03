## Objetivo

1. En **Ecommerce → Liquidaciones → Historial**: filtrar por rango de fechas y ver el total pagado del período.
2. En **Finanzas**: mostrar un resumen de "Liquidaciones de eCommerce" con el total pagado del mes según el filtro de fechas.

## Cambios

### 1. `src/pages/ecommerce/Settlements.tsx` — Historial de Liquidaciones

- Agregar estado `histDesde` / `histHasta` (default: primer y último día del mes actual).
- Agregar selector `histTipoFecha` con dos opciones:
  - **Fecha de pago** (default) → filtra por `fecha_pago` (solo aparecen las pagadas en el rango).
  - **Período de liquidación** → filtra por `periodo_inicio`/`periodo_fin` solapando el rango.
- Actualizar la query `seller-liquidaciones` para incluir estas fechas en la `queryKey` y aplicar el filtro en Supabase (subir el `limit` a 500 dentro del rango en vez del top 50 histórico).
- Agregar los inputs de fecha + selector arriba de los filtros existentes de estado/seller.
- El KPI "Total Pagado" ya existe → queda restringido al rango automáticamente.
- Agregar botón "Limpiar" que resetea al mes actual.

### 2. `src/components/finanzas/LiquidacionesManualesTab.tsx` (o nueva tarjeta en `Finanzas.tsx`)

Agregar una nueva tarjeta/sección **"Liquidaciones de eCommerce"** dentro de la página Finanzas, usando el mismo rango `desde`/`hasta` que ya tiene el módulo:

- Query a `liquidaciones_seller` filtrando por `fecha_pago` entre `desde` y `hasta` y `estado = 'pagada'`.
- Mostrar KPIs:
  - Cantidad de liquidaciones pagadas
  - Total pagado (suma `total_pagos`)
  - Total cargos del período
- Tabla compacta (últimas 10) con seller, período, fecha de pago, monto y link "Ver" que abre `/ecommerce/settlements` (o el detalle existente).

### 3. Ubicación en Finanzas

Agregar un nuevo `TabsTrigger` **"Liquidaciones eCommerce"** en `src/pages/Finanzas.tsx` junto al de "Liquidaciones manuales", renderizando el nuevo componente `LiquidacionesEcommerceTab.tsx`.

## Detalles técnicos

- La columna `fecha_pago` es `timestamp` nullable → usar `.gte()` / `.lte()` con `toLocalISOStart` / `toLocalISOEnd` de `src/lib/dateUtils.ts`.
- Los filtros de estado/seller existentes en Historial se mantienen y se aplican encima del filtro por fechas.
- El componente nuevo `LiquidacionesEcommerceTab` es read-only (no edita/paga desde Finanzas — solo visualiza y linkea).
