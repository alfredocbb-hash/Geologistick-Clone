

# Mostrar detalle de conceptos en liquidaciones de sucursal (vista operador + PDF)

## Problema
La sucursal ve la liquidación pero no puede ver el desglose por conceptos (Contado, Pago Destino, Cta. Cte.) ni en el diálogo de detalle ni en el PDF descargado.

## Causa raíz
1. **MyCommissions.tsx**: La query de `liquidaciones_sucursal` no incluye `resumen_conceptos` en la interfaz `LiquidacionSucursal`, por lo que el campo se pierde al tipar los datos. Al pasarlo al `SettlementDetailDialog`, no tiene el dato.
2. **PDF (`generateSettlementPDF.ts`)**: La función `downloadBranchSettlementPDF` no incluye la sección de desglose por conceptos en el PDF generado. Solo lista envíos individuales.

## Plan de cambios

### 1. `src/pages/MyCommissions.tsx`
- Agregar `resumen_conceptos` a la interfaz `LiquidacionSucursal`
- Asegurar que al pasar `selectedBranchLiq` al `SettlementDetailDialog`, el campo `resumen_conceptos` se incluya (ya viene del select `*`)

### 2. `src/lib/generateSettlementPDF.ts`
- En `SettlementPDFData`, agregar campo opcional `resumenConceptos`
- En `downloadBranchSettlementPDF`, pasar `resumen_conceptos` de la liquidación al `generateSettlementPDF`
- En `generateSettlementPDF`, si `type ===