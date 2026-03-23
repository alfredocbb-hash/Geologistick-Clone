

## Plan: Mostrar cargos globales por día en el PDF de liquidación de seller

### Problema
El PDF de liquidación de seller muestra "Movimientos: 187" (que no se quiere ver) y no detalla el cargo por retiro/día ($7.000 × 5 días = $35.000), aunque está incluido en el total.

### Cambios en `src/lib/generateSettlementPDF.ts`

**1. Agregar soporte para `cargosGlobalesDia` en la interfaz `SettlementPDFData`**
- Nuevo campo opcional: `cargosGlobalesDia?: Array<{ nombre: string; monto_dia: number; dias: number; total: number }>`

**2. Modificar el bloque financiero del PDF para tipo `seller`**
- Quitar la línea "Movimientos: N"
- Antes de "SALDO DEL PERÍODO", agregar una línea por cada cargo global (ej: "Retiro por día: 5 días × $7.000 = $35.000")
- Ajustar la altura del box (`boxH`) dinámicamente según la cantidad de cargos globales

**3. Pasar los cargos globales desde `downloadSellerSettlementPDF`**
- Parsear los cargos desde el campo `notas` de la liquidación (donde se guardan como texto: `"Retiro_dia: 5 días × $7.000 = $35.000"`)
- Extraer nombre, días, monto por día y total usando un regex simple

### Archivos a modificar
- `src/lib/generateSettlementPDF.ts`

