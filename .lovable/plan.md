## Problema

En el PDF de liquidación de seller "Esc Audio" (período 25/04 - 02/05):
1. **Total inconsistente**: Header dice `$130.322,87` (valor guardado), pero el subtotal al pie dice `$168.431,83` (suma real de las 20 filas). El `total_cargos` quedó desactualizado tras editar precios fuera del flujo "Guardar cambios" del diálogo.
2. **Faltan envíos en $0 modificados**: solo aparecen los envíos con `liquidacion_seller_id` apuntando a esta liquidación. Los envíos del período que fueron puestos a $0 manualmente pero nunca quedaron linkeados (porque al crear la liquidación estaban `pendiente`, `cancelado sin visitas`, o se actualizaron después) no aparecen en el PDF ni en el detalle.

## Solución

### 1. Recalcular `total_cargos` antes de generar el PDF

En `src/lib/generateSettlementPDF.ts > downloadSellerSettlementPDF`:
- Tras traer los envíos linkeados, calcular `recomputedTotal = sum(precio_total)` excluyendo cancelados sin visitas.
- Si difiere de `liquidacion.total_cargos`, hacer un `update` a `liquidaciones_seller` (`total_cargos`, `saldo_periodo`, `saldo_final`) para mantener una única fuente de verdad.
- Pasar `totalCargos: recomputedTotal` al `generateSettlementPDF` para que el header coincida con el subtotal del pie.

Esto garantiza que header y pie siempre coincidan, sin depender de que el usuario haya pulsado "Guardar cambios" en el diálogo.

### 2. Incluir todos los envíos del seller en el período

Cambiar la query del PDF (y la del `SellerLiquidacionDetailDialog`) para no filtrar solo por `liquidacion_seller_id`, sino traer:
- Envíos con `liquidacion_seller_id = liquidacion.id` **OR**
- Envíos del seller (`remitente_id = liquidacion.seller_id`) en el rango `[periodo_inicio, periodo_fin]` que **no estén liquidados en otra liquidación** (`liquidacion_seller_id IS NULL`) y no estén `pendiente`.

Para los envíos "huérfanos" detectados, hacer un `update` linkeándolos a esta liquidación (`liquidacion_seller_id = liquidacion.id`) durante la generación del PDF, así también quedan formalmente incluidos. Esto cubre el caso de envíos a $0 modificados después de crear la liquidación.

### 3. Aplicar mismo recálculo en el diálogo de detalle

`SellerLiquidacionDetailDialog.tsx`:
- Usar la misma query expandida (linkeados + huérfanos del período).
- Al abrir, si hay desincronía entre `total_cargos` y `adjustedTotal`, mostrar advertencia o auto-recalcular silenciosamente para liquidaciones en estado `generada`.

## Archivos a modificar

- `src/lib/generateSettlementPDF.ts` (función `downloadSellerSettlementPDF`, líneas 684-765): nueva query, recálculo y update.
- `src/components/ecommerce/SellerLiquidacionDetailDialog.tsx` (líneas 64-78): query expandida.

## Notas

- El recálculo respeta la regla existente: cancelados sin visitas → $0 (memoria `cancelled-visits-charge`).
- No se tocan envíos en estado `pendiente` (memoria `exclude-pending`).
- El link automático a `liquidacion_seller_id` solo afecta a envíos sin liquidación previa, evitando doble facturación.
