

# Eliminar sección de Movimientos del detalle de liquidaciones de seller

## Cambios

### 1. `src/components/ecommerce/SellerLiquidacionDetailDialog.tsx`
- Eliminar la query de movimientos (`seller_cuenta_corriente`)
- Eliminar el tab "Movimientos" del `TabsList` (dejar solo "Resumen" y "Envíos")
- Eliminar el `TabsContent value="detalle"` completo (la tabla de movimientos)
- Cambiar el tab por defecto o mantener "resumen"

### 2. `src/lib/generateSettlementPDF.ts`
- En la funcion `generateSettlementPDF`: cuando es seller (`isSeller`), no renderizar la seccion "DETALLE DE MOVIMIENTOS" (las lineas que pintan la tabla de movimientos con Fecha/Tipo/Descripcion/Monto)
- Mantener la seccion "DETALLE DE ENVIOS" que ya existe para sellers
- En `downloadSellerSettlementPDF`: eliminar la query a `seller_cuenta_corriente` y el mapeo de `items` de movimientos. Pasar un array vacio como `items` ya que la seccion de movimientos no se renderizara

