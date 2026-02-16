
# Fix: Períodos de liquidaciones se muestran con fecha incorrecta

## Problema

Las fechas de período (`periodo_inicio`, `periodo_fin`) se almacenan como tipo `date` en la base de datos (ej: `"2026-02-09"`). Al hacer `new Date("2026-02-09")`, JavaScript interpreta esto como medianoche UTC. En Argentina (UTC-3), esto se convierte en **8 de febrero a las 21:00**, mostrando el dia anterior.

Los datos en la base estan correctos (`periodo_inicio: 2026-02-09`, `periodo_fin: 2026-02-13`), pero la visualizacion muestra un dia menos.

## Solucion

El proyecto ya tiene la funcion `parseDateString()` en `src/lib/dateUtils.ts` que resuelve exactamente este problema: extrae los componentes de la fecha sin conversion de zona horaria.

Se debe reemplazar `new Date(liq.periodo_inicio)` por `parseDateString(liq.periodo_inicio)` en todos los archivos afectados.

## Archivos a modificar (9 archivos)

### 1. `src/pages/ecommerce/Settlements.tsx`
- Linea 1482: reemplazar `new Date(liq.periodo_inicio)` y `new Date(liq.periodo_fin)` por `parseDateString()`

### 2. `src/pages/BranchSettlements.tsx`
- Linea 969-970: tabla de liquidaciones
- Linea 1157: dialogo de cancelacion

### 3. `src/pages/DriverSettlements.tsx`
- Linea 835-836: tabla de liquidaciones
- Linea 985: dialogo de cancelacion

### 4. `src/pages/PrintSettlement.tsx`
- Linea 268: vista de impresion del periodo

### 5. `src/pages/MyCommissions.tsx`
- Linea 371-372: tabla de liquidaciones del chofer

### 6. `src/components/ecommerce/SellerLiquidacionDetailDialog.tsx`
- Linea 183: detalle de liquidacion del seller

### 7. `src/components/settlements/SettlementDetailDialog.tsx`
- Linea 174: generacion de PDF del detalle

### 8. `src/lib/generateSettlementPDF.ts`
- Linea 71: periodo en PDF
- Lineas 180, 182, 184: nombre del archivo PDF

### 9. `src/components/mobile/MobileEarningsTab.tsx`
- Linea 182: vista mobile de ganancias

Cada archivo recibira el import de `parseDateString` desde `@/lib/dateUtils` y se reemplazaran todas las instancias de `new Date()` aplicadas a campos `periodo_inicio` y `periodo_fin`.
