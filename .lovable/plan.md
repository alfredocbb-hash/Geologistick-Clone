

## Plan: Editar precios de envíos en liquidación no aprobada

### Problema
Una vez generada la liquidación, el diálogo de detalle muestra los precios como solo lectura. El administrador no puede corregir precios sin cancelar y regenerar la liquidación completa.

### Solución
Hacer editables los precios de cada envío en el tab "Envíos" del `SellerLiquidacionDetailDialog`, solo cuando el estado de la liquidación es `generada` (no aprobada, no pagada, no cancelada).

### Cambios en `SellerLiquidacionDetailDialog.tsx`

1. **Precio editable por envío**: En la columna "Precio" de la tabla de envíos, si `liquidacion.estado === 'generada'` y el envío no está excluido, mostrar un `Input` editable en lugar del texto fijo. Mantener los cambios en estado local.

2. **Botón "Guardar Cambios"**: Agregar un botón debajo de la tabla que:
   - Actualice `envios.precio_total` en la base de datos para cada envío modificado
   - Recalcule y actualice `liquidaciones_seller.total_cargos` y `saldo_periodo` y `saldo_final` con los nuevos totales
   - Invalide las queries relacionadas para refrescar los datos
   - Solo se muestre cuando hay cambios pendientes

3. **Indicador visual**: Mostrar el botón solo cuando hay diferencias entre los precios editados y los originales. Mostrar un badge "Editado" en los envíos con precio modificado.

### Archivos a modificar
- `src/components/ecommerce/SellerLiquidacionDetailDialog.tsx`

