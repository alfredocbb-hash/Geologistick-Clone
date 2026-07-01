# Plan: Totales y comparativa Ingresos vs Gastos en Facturación

## Objetivo
Sumar a la pestaña **Emitidas** (y una nueva vista de resumen) totales agregados y una comparación contra gastos e ingresos reales, respetando el filtro de fechas `Desde`/`Hasta` que ya vamos a agregar.

## 1) Totales en la pestaña Emitidas
Debajo de los filtros (búsqueda, tipo, fechas), agregar 4 tarjetas KPI que se recalculan con `useMemo` sobre `filteredEmitidas`:

- **Cantidad de facturas** emitidas en el rango
- **Neto gravado** (suma de `neto` / subtotal)
- **IVA** (suma de `iva`)
- **Total facturado** (suma de `total`)

Desglose adicional debajo (chips o mini-tabla): totales por tipo de comprobante (A / B / C / Nota de Crédito). Las Notas de Crédito restan al total facturado.

## 2) Nueva pestaña "Resumen" en Facturación
Nueva tab al lado de Emitidas / Recibidas / Configuración. Comparte los mismos filtros de fecha (`Desde` / `Hasta`, default = mes actual).

Contenido:

### a) Tarjetas comparativas
- **Ingresos facturados** — suma de `facturas` emitidas (total) en el rango, menos notas de crédito.
- **Ingresos cobrados** — suma de `pagos` en el rango con `estado IN ('cobrado_chofer','rendido','pagado')` (COD + otros).
- **Gastos** — suma de `gastos` en el rango.
- **Facturas de compra** — suma de `facturas_compra` (IVA crédito fiscal + total) en el rango.
- **Resultado** = Ingresos facturados − Gastos − Facturas de compra. Color verde/rojo según signo.

### b) IVA (posición fiscal del período)
- **IVA débito fiscal** (de `facturas` emitidas)
- **IVA crédito fiscal** (de `facturas_compra`)
- **Saldo IVA** = débito − crédito

### c) Gráfico comparativo
Bar chart (recharts, ya usado en el proyecto) con series **Ingresos** vs **Gastos** agrupadas por mes dentro del rango. Si el rango es de un solo mes, agrupa por semana.

### d) Top categorías de gasto
Lista/tabla con las 5 categorías de `gastos` con mayor monto en el rango.

## 3) Fuentes de datos
Todo cliente-side sobre queries ya existentes o nuevas, filtradas por `tenant_id` y rango:
- `facturas` + `factura_detalles` (ya cargadas en Facturación)
- `facturas_compra` (ya cargadas)
- `gastos` (nueva query en la pestaña Resumen)
- `pagos` (nueva query, filtrada por `created_at` en rango)

Sin cambios en base de datos ni Edge Functions.

## 4) UX
- Filtros `Desde` / `Hasta` compartidos entre Emitidas y Resumen mediante `useState` en `Facturacion.tsx` (o un pequeño contexto local).
- Botón **Limpiar** resetea a mes actual.
- Formato de moneda ARS consistente con el resto del módulo.
- Los KPIs usan los componentes `Card` existentes; el gráfico usa `ChartContainer` con tokens semánticos (`hsl(var(--chart-1))`, etc.), sin colores hardcodeados.

## Alcance
Solo frontend + queries de lectura. No toca lógica fiscal, ARCA, ni tablas.
