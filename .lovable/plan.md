
Objetivo: que los envíos en estado `pendiente` no aparezcan ni en la consulta previa ni dentro de la liquidación de seller (no solo en $0, sino excluidos).

Hallazgo clave: hoy `pendiente` se deja con `precioFinal = 0`, pero igual queda en `calculatedEnvios`, se vincula con `liquidacion_seller_id` al generar, y luego vuelve a aparecer en el detalle.

Plan de implementación

1) Excluir `pendiente` desde el origen del cálculo (no solo ponerlo en 0)
- Archivo: `src/pages/ecommerce/Settlements.tsx`
- En `calculateMutation`:
  - Filtrar `ecommerceEnvios` y `filteredCommonEnvios` para que no incluyan `estado === 'pendiente'`.
  - Aplicar un filtro defensivo antes del map final (`allEnviosData`) para garantizar que no pase ninguno pendiente.
  - Eliminar el bloque que hoy hace `precioFinal = 0` para pendientes (ya no deberían entrar).
- Resultado: no aparecen en “Resumen Envíos”, no suman cantidad, no entran al total ni al botón de generar.

2) Evitar que se vinculen pendientes al generar liquidación
- Archivo: `src/pages/ecommerce/Settlements.tsx`
- En `generateMutation`:
  - Agregar guard clause defensivo en el loop de `sellerEnvios` para saltar cualquier envío pendiente si llegara por datos legacy/cache.
- Resultado: nuevas liquidaciones no enlazan pendientes en `envios.liquidacion_seller_id`.

3) Ajustar conteos y consulta de “Saldos por Seller”
- Archivo: `src/pages/ecommerce/Settlements.tsx`
- En `sellerBalances`:
  - Mantener exclusión de pendientes en el total.
  - Corregir `cantEnvios` para contar solo envíos efectivamente liquidables (hoy cuenta IDs totales, incluidos pendientes/cancelados sin visitas).
- Resultado: la grilla de saldos no “trae” pendientes en la cantidad operativa mostrada.

4) Excluir pendientes en el detalle de liquidación ya generada
- Archivo: `src/components/ecommerce/SellerLiquidacionDetailDialog.tsx`
- En query de envíos de la liquidación:
  - Excluir `estado = 'pendiente'` en la consulta (y mantener filtro defensivo en memoria).
- Resultado: aunque existan liquidaciones históricas con pendientes vinculados, no se muestran en la consulta del detalle.

5) Consistencia en PDF de seller (misma regla visual)
- Archivo: `src/lib/generateSettlementPDF.ts`
- En `downloadSellerSettlementPDF`:
  - Excluir pendientes al traer envíos para el PDF.
- Resultado: lo que se ve en pantalla y lo que se descarga quedan alineados.

Validación (end-to-end)
- Caso 1: período con entregados + pendientes -> en cálculo solo aparecen los liquidables.
- Caso 2: generar liquidación -> verificar que ningún `pendiente` quede con `liquidacion_seller_id`.
- Caso 3: abrir detalle de liquidación histórica que tenía pendientes -> no deben listarse.
- Caso 4: descargar PDF de esa liquidación -> tampoco deben figurar pendientes.

Notas técnicas
- No requiere migraciones de base de datos.
- Se mantiene intacta la regla ya implementada para cancelados sin visitas (`$0`), solo se cambia la semántica de `pendiente` a “exclusión total”.
