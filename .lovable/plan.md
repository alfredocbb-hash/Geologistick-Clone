## Problema

En la liquidación del chofer (dialog de detalle, PDF y Excel) solo se muestra la columna "Comisión" por envío. No se ven los envíos con cobro contra entrega (COD) ni el monto descontado al chofer por esos cobros, aunque sí se descuentan al generar la liquidación (queda registrado solo como texto en "notas").

## Causa

`SettlementDetailDialog.tsx` arma la tabla / PDF / Excel del chofer usando solo `comisiones.monto`. El query de `comisiones` trae `envio.precio_total` pero no `pago_contra_entrega`, y nunca se renderiza el dato de COD ni el descuento.

## Cambios (solo UI / presentación, sin tocar lógica de generación ni base de datos)

### `src/components/settlements/SettlementDetailDialog.tsx`

1. **Query `driverComisiones`**: agregar `pago_contra_entrega` al select del envío:
   ```
   envio:envios(..., precio_total, pago_contra_entrega, ...)
   ```

2. **Helpers derivados** (solo para chofer):
   - `totalComisionesEnvios` = suma de `comision.monto`.
   - `totalCobradoDestino` = suma de `envio.precio_total` de envíos con `pago_contra_entrega = true`.
   - `totalDescontado` = `max(0, totalComisionesEnvios − driverData.monto_total)` (lo que efectivamente se le descontó al chofer al pagar las liquidaciones con COD).

3. **Tab "Resumen" (chofer)**: convertir la card "Monto Total a Pagar" en un grid de 3 cards cuando haya COD:
   - Comisiones del período (`totalComisionesEnvios`).
   - Cobros en destino (`totalCobradoDestino`) — verde si > 0.
   - Descontado al chofer (`totalDescontado`) — rojo si > 0.
   - Card final destacada "Monto Neto a Pagar" (`driverData.monto_total`).

4. **Tab "Detalle de Envíos" (chofer)**: agregar dos columnas:
   - `COD` — badge "Sí / —" según `envio.pago_contra_entrega`.
   - `Cobrado en Destino` — `$envio.precio_total` si COD, si no `—`.
   - Mantener columna `Comisión` existente.
   - Fila final de totales: Comisiones, Cobrado en Destino, Descontado, Neto a Pagar.

5. **PDF (`generatePDF`, rama chofer)**:
   - Bloque de totales: agregar líneas "Comisiones", "Cobrado en Destino", "Descontado" y "MONTO NETO A PAGAR".
   - Tabla de envíos: agregar columnas "COD" y "Cobrado Destino" (mostrar `$precio_total` solo en filas COD), reajustar anchos de columnas.

6. **Excel (`handleExportExcel`, rama chofer)**:
   - Agregar al objeto `data`: `cod` ("Sí"/""), `cobrado_destino` (number, currency).
   - Agregar en `columns` (solo chofer): "COD", "Cobrado en Destino" (format currency), manteniendo "Comisión".

### Sucursal y demás

Sin cambios. La rama `isBranch` ya muestra Total Cobrado / Comisiones / Saldo y no necesita ajuste.

## QA

- Abrir liquidación de Ariel Kersul (25/05–30/05): la tabla, el PDF y el Excel deben mostrar los envíos con `pago_contra_entrega`, su precio cobrado y el descuento total reflejado.
- Verificar liquidación sin COD: no aparecen las cards extras y la columna "Cobrado en Destino" queda en "—".
- Verificar que el "Monto Neto a Pagar" mostrado coincide con `liquidacion.monto_total` ya guardado.
