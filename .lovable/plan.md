## Objetivo
Agregar botón **Excel** en el diálogo "Liquidación de Chofer" (y también Sucursal, mismo diálogo) para descargar el detalle de envíos como `.xlsx` y verlo en tabla.

## Cambios

**`src/components/settlements/SettlementDetailDialog.tsx`**
- Importar `exportToExcel` desde `@/lib/exportExcel` y el ícono `FileSpreadsheet` de lucide.
- Agregar un tercer botón en el header (junto a Imprimir / PDF): **Excel**.
- Al hacer click, generar archivo con:
  - Nombre: `liquidacion-chofer-<nombre>-<fecha>.xlsx` (o `liquidacion-sucursal-...` según corresponda).
  - Hoja "Detalle de Envíos" con columnas: Tracking, Fecha, Destinatario, Dirección, Ciudad, Estado, Comisión (currency).
  - Para sucursales se ajustan columnas equivalentes (Tracking, Fecha, Destinatario, Estado, Importe).
- Reutilizar la misma fuente de datos que ya alimenta el tab "Detalle de Envíos" (no se cambia lógica de negocio, sólo presentación/exportación).

## Notas técnicas
- `exportToExcel` ya existe en `src/lib/exportExcel.ts` y soporta formato `currency`, así que no se necesitan dependencias nuevas.
- Sin cambios en backend, RLS, queries ni cálculos. Solo UI/exportación.
