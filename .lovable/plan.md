

## Plan: Mostrar descuentos COD en el PDF de liquidación de choferes

### Problema
Cuando se genera una liquidación de chofer con descuentos por cobro en destino (COD), el PDF solo muestra el monto total neto. No se ve el desglose de comisiones brutas vs descuentos COD, haciendo que el chofer no entienda por qué el monto es menor a la suma de sus comisiones.

### Solución
Modificar el PDF de liquidación de choferes para mostrar un bloque de resumen financiero con el desglose: Comisiones brutas → Descuentos COD → Monto Neto.

### Cambios

**Archivo: `src/lib/generateSettlementPDF.ts`**

1. **Ampliar la interfaz `SettlementPDFData.totals`**: Agregar campos opcionales `totalComisionesChofer` y `totalDescuentosCOD` para choferes.

2. **Modificar el bloque "Financial summary box" para driver** (líneas ~284-293): Si existen descuentos COD, mostrar 3 líneas en vez de 2:
   - `Comisiones: $X`
   - `Descuentos COD: -$Y`
   - `MONTO NETO: $Z`
   
   Aumentar el alto del box cuando hay descuentos COD.

3. **En `downloadDriverSettlementPDF`** (líneas ~558-576): Parsear los valores de comisiones y descuentos COD desde el campo `notas` de la liquidación (formato "Comisiones: $X | Descuentos COD: -$Y") y pasarlos como `totals.totalComisionesChofer` y `totals.totalDescuentosCOD`.

### Detalle del parseo de notas
El sistema ya guarda en `notas`: `Comisiones: $12500.00 | Descuentos COD: -$8000.00`
Se extraerán con regex los valores numéricos para reconstruir el desglose.

Si no se encuentran descuentos COD en las notas (liquidaciones sin COD), el PDF se renderiza exactamente como antes.

