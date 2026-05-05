## Problema

El envío `ML-46924487035` aparece en el PDF de la liquidación de **Esc Audio del 19/04 - 25/04**, pero:
- Fecha de venta (created_at): 24/04
- Fecha de entrega: 27/04 → debería estar en la liquidación del **25/04 - 02/05**

### Causa raíz

Cuando se generó la liquidación 19-25/04, este envío todavía no estaba entregado, así que correctamente NO se incluyó. Pero al descargar el PDF, la lógica de "huérfanos" que agregamos en el paso anterior busca envíos del seller con `liquidacion_seller_id IS NULL` filtrando por **`created_at`** dentro del período. Como el envío fue creado el 24/04, lo "adopta" indebidamente y además lo auto-vincula a esa liquidación.

Esto contradice la regla del sistema (`mem://features/settlements/estrategias-consulta-liquidaciones`): para e-commerce los envíos deben asignarse a una liquidación según `fecha_entrega` (cuándo se entregó / repartió), no según `created_at`.

## Solución

Alinear la búsqueda de huérfanos con la misma lógica dual que usa el generador de liquidaciones (`src/pages/ecommerce/Settlements.tsx`):

1. Envíos con `fecha_entrega` dentro del período → incluir.
2. Envíos sin `fecha_entrega` (no entregados todavía) → incluir solo si `created_at` cae en el período Y el estado no es final ambiguo. En la práctica conviene **excluirlos** para evitar adopciones erróneas: si un envío aún no se entregó, debe esperar la liquidación del período en que efectivamente se entregue.

### Cambios

**`src/lib/generateSettlementPDF.ts`** (función `downloadSellerSettlementPDF`, lóg. de huérfanos ~líneas 719-736):
- Reemplazar el filtro `.gte('created_at', ...)` / `.lte('created_at', ...)` por `.gte('fecha_entrega', ...)` / `.lte('fecha_entrega', ...)`.
- Quitar de huérfanos los envíos con `fecha_entrega IS NULL` (no se reparten todavía → no liquidar).
- Mantener el auto-link de los huérfanos verdaderos (los que efectivamente se entregaron en el período y quedaron sin liquidar).

**`src/components/ecommerce/SellerLiquidacionDetailDialog.tsx`** (~líneas 79-86):
- Mismo cambio: filtrar huérfanos por `fecha_entrega` dentro del período en lugar de `created_at`.
- Excluir los que tienen `fecha_entrega = NULL`.

### Limpieza puntual del envío mal vinculado

Si la liquidación 19-25/04 de Esc Audio quedó con `total_cargos` recalculado incluyendo este envío, al recargar el PDF con la lógica corregida el `recomputedTotal` lo excluirá y volverá a sincronizar `total_cargos` / `saldo_periodo` / `saldo_final` en la base, siempre que la liquidación esté en estado `generada`. Si ya está `aprobada` o `pagada`, no se sobreescribe — en ese caso el usuario puede:
- Editar manualmente el monto, o
- Marcarla como "generada" temporalmente para forzar el recálculo.

Y al generar la próxima liquidación del seller para 25/04 - 02/05, este envío aparecerá correctamente porque su `fecha_entrega` (27/04) cae en ese rango.

## Resumen

Cambiar el criterio de búsqueda de envíos huérfanos en el detalle y PDF de liquidaciones e-commerce, usando `fecha_entrega` en lugar de `created_at`, alineado con la lógica oficial del generador.