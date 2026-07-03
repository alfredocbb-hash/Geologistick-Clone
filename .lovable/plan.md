
## Objetivo

En `Control de Caja` (`src/pages/Cash.tsx`) mostrar el detalle discriminado por método de pago (Efectivo, Transferencia, Mercado Pago, Tarjeta) en dos lugares:

1. **Resumen por Categoría** (Rendiciones COD, Cobros Directos, Liquidaciones Pagadas, Otros Movimientos): actualmente sólo muestra Efectivo y Digital. Se reemplaza por un renglón por cada método con movimientos > 0.
2. **Movimientos del Día**: se agrega debajo de la tabla una fila / bloque de "Totales por método" que sume los movimientos listados, con ingresos, egresos y neto por método.

## Cambios en `src/pages/Cash.tsx`

### 1. Resumen por Categoría (aprox. líneas 679-729)
- Cambiar `sumCategory` para devolver también un desglose `porMetodo: Record<PaymentMethod, { ingresos, egresos, total }>` en lugar de sólo `efectivo`/`digital`.
- En la tarjeta de cada categoría reemplazar los renglones "Efectivo: …" / "Digital: …" por un `map` sobre los métodos con monto > 0, mostrando: `Efectivo: $…`, `Transferencia: $…`, `Mercado Pago: $…`, `Tarjeta: $…`. Se usan los labels de `PAYMENT_METHOD_LABELS`.
- Mantener `count`, el total y el color/ícono actuales.

### 2. Movimientos del Día (aprox. líneas 734-821)
- Al final del `CardContent` de "Movimientos del Día", agregar un pie fijo con "Totales por método (movimientos del día)".
- Se reutiliza `totals.porMetodo` (ya calculado en `totals` líneas 456-478), mostrando por cada método con movimiento: label, ingresos en verde (+), egresos en rojo (-) y neto. Grilla responsive 2/4 columnas, mismo estilo que la sección superior "Totales por método de pago" para consistencia visual.
- Sólo se muestra si `movements.length > 0`.

## Sin cambios de negocio

Sólo presentación. No se modifican queries, cálculo de saldo esperado, cierre de caja ni lógica de aprobación.
