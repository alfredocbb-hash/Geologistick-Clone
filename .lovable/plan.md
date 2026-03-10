

# Agregar Ver Detalle, PDF, Imprimir y Facturación a Liquidaciones Terciarizados

## Problema
La tabla de historial de liquidaciones terciarizadas solo tiene botones "Pagar" y "Cancelar". Faltan: ver detalle, descargar PDF, imprimir, y facturación (similar a sellers).

## Cambios

### 1. Migración SQL: agregar `factura_id` a `liquidaciones_terciarizado`
```sql
ALTER TABLE liquidaciones_terciarizado 
ADD COLUMN factura_id uuid REFERENCES facturas(id);
```

### 2. Nuevo componente: `src/components/settlements/ThirdPartySettlementDetailDialog.tsx`
Dialog de detalle similar a `SellerLiquidacionDetailDialog`:
- Query `liquidacion_terciarizado_detalles` con join a `envios(tracking_number, tracking_externo, nombre_destinatario, precio_total, fecha_entrega, estado)`
- Tabs: "Resumen" (empresa, período, montos neto/IVA/total, datos de pago, factura vinculada) y "Envíos" (tabla con tracking, destinatario, fecha entrega, monto)
- Botones en header: Facturar (abre `InvoiceDataDialog` con `liquidacion_terciarizado_id` — requiere adaptar), Imprimir (link a `/print-settlement?id=X&type=third-party`), Descargar PDF
- Al facturar exitosamente, vincula `factura_id` a la liquidación

### 3. Modificar `src/pages/ThirdPartySettlements.tsx`
- Agregar estado `detailDialog` para el dialog de detalle
- En la tabla de historial (líneas 659-677), agregar botones:
  - **Ver Detalle** (Eye) → abre `ThirdPartySettlementDetailDialog`
  - **Descargar PDF** (Download) → genera PDF directamente
  - **Imprimir** (Printer) → link a `/print-settlement?id=X&type=third-party`
- Los botones Pagar/Cancelar se mantienen para estado "generada"

### 4. Modificar `src/lib/generateSettlementPDF.ts`
- Agregar función `downloadThirdPartySettlementPDF(liquidacion, branding?)`:
  - Consulta `liquidacion_terciarizado_detalles` con join a `envios`
  - Genera PDF con header branding, resumen financiero (neto/IVA/total), y tabla de envíos (tracking, destinatario, fecha, monto)
  - Usa la misma estructura de `generateSettlementPDF` con type `'third-party'`

### 5. Modificar `src/pages/PrintSettlement.tsx`
- Agregar soporte para `type=third-party`:
  - Query: `liquidaciones_terciarizado` con join a `empresa:empresas_terciarizadas(nombre, cuit)`
  - Items: `liquidacion_terciarizado_detalles` con join a `envios`
  - Renderizar con la misma estructura visual, mostrando empresa como entidad

### 6. Adaptar `InvoiceDataDialog` (menor)
- El componente ya acepta `liquidacionSellerId` como prop. Agregar prop opcional `liquidacionTerciarizadoId` para que el edge function `arca-factura` pueda recibir este ID y vincular la factura correctamente.
- Alternativamente, reutilizar el campo genérico existente si la edge function lo permite.

## Notas técnicas
- La tabla `liquidaciones_terciarizado` ya tiene `monto_iva`, `monto_neto`, `monto_total` — el IVA ya se calcula al generar.
- El patrón de facturación se copia de `SellerLiquidacionDetailDialog`: botón "Facturar" → `InvoiceDataDialog` → on success → update `factura_id`.
- La empresa terciarizada ya tiene campo `cuit` para datos fiscales.

