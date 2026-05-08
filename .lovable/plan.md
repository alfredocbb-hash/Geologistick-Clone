## Objetivo

Al duplicar una factura desde la pestaña "Emitidas", el diálogo "Duplicar Factura" debe traer también:

- **Concepto** (Productos / Servicios / Productos+Servicios)
- **Fecha de servicio desde** y **hasta** (período facturado)
- **Fecha de vencimiento de pago**
- **Descripción / detalle general**
- **Items de detalle** (line_items)

Hoy solo se precargan: tipo de comprobante, CUIT, nombre, condición IVA, domicilio e importe total.

## Cambios (un solo archivo: `src/pages/Facturacion.tsx`)

### 1. Nuevos estados para el duplicado
Agregar junto a `duplicateImporte`:
- `duplicateConcepto` (number, default 1)
- `duplicateFechaServicioDesde`, `duplicateFechaServicioHasta`, `duplicateFechaVtoPago` (string YYYY-MM-DD)
- `duplicateDescripcion` (string)
- `duplicateLineItems` (array, mismo shape que `InvoiceLineItems`)

### 2. `handleDuplicate(factura)` (línea ~349)
Precargar desde la factura origen:
```
duplicateConcepto       <- factura.concepto ?? 1
duplicateFechaServicioDesde <- factura.fecha_servicio_desde?.slice(0,10) ?? ''
duplicateFechaServicioHasta <- factura.fecha_servicio_hasta?.slice(0,10) ?? ''
duplicateFechaVtoPago   <- factura.fecha_vto_pago?.slice(0,10) ?? ''
duplicateDescripcion    <- factura.descripcion ?? ''
duplicateLineItems      <- (factura.line_items ?? []) as array
```

### 3. UI en el diálogo "Duplicar Factura" (línea ~808)
Dentro del `DialogContent` agregar (después de `InvoiceFormFields showImporte`):

- Select de **Concepto** (1 Productos / 2 Servicios / 3 Productos+Servicios), reutilizando el patrón de `EmitirFacturaDialog`.
- Si `concepto === 2 || 3`: tres `Input type="date"` para Desde / Hasta / Vto. Pago (obligatorios).
- `<InvoiceLineItems items={duplicateLineItems} onChange={setDuplicateLineItems} />` (mismo componente usado en `EmitirFacturaDialog`).
- `Textarea` "Descripción / Notas" ligado a `duplicateDescripcion`.

Hacer scrollable el contenido (`max-h-[85vh] overflow-y-auto`) porque el diálogo crece.

### 4. `handleEmitDuplicate` (línea ~361)
Enviar los nuevos campos al edge function `arca-factura`:
```
concepto: duplicateConcepto,
fecha_servicio_desde: needsServiceDates ? duplicateFechaServicioDesde : undefined,
fecha_servicio_hasta: needsServiceDates ? duplicateFechaServicioHasta : undefined,
fecha_vto_pago:       needsServiceDates ? duplicateFechaVtoPago : undefined,
descripcion: duplicateDescripcion || undefined,
line_items:  duplicateLineItems.length ? duplicateLineItems : undefined,
```
Validar que si `concepto` 2/3, las tres fechas estén cargadas (toast de error si no).

Botón "Emitir Factura" se deshabilita además si faltan esas fechas obligatorias.

### 5. `resetForm`
Resetear los nuevos estados a sus defaults.

## Fuera de alcance
- No se toca `arca-factura` (ya soporta todos estos campos).
- No se modifica el flujo de "Cargar Manual" ni "Facturar en Lote".
- No se cambia la tabla `facturas`.
