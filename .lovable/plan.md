
# Imprimir Factura y Liquidaciones

## Resumen

Actualmente el sistema tiene:
- **Facturas**: Los datos se guardan en la tabla `facturas` y en campos del envio (`factura_cae`, `factura_numero`, `factura_tipo`, `factura_fecha`), pero NO existe una pagina para imprimir/visualizar la factura.
- **Liquidaciones**: Se generan PDFs descargables via `jsPDF` (descarga archivo), pero NO hay una vista previa imprimible en pantalla como la que existe para comprobantes de envio (`/print-receipt`).

El plan es crear paginas de impresion dedicadas que sigan el mismo patron de `/print-receipt`: una vista previa en pantalla con boton de descarga PDF e impresion.

---

## Parte 1: Pagina de impresion de Factura

### Nueva pagina: `src/pages/PrintInvoice.tsx`

Ruta: `/print-invoice?id={envio_id}`

Contenido:
- Consulta la tabla `facturas` filtrando por `envio_id`
- Consulta los datos del envio (remitente, destinatario, detalles de conceptos)
- Consulta el branding del tenant (logo, nombre)
- Muestra una vista previa de factura electronica con:
  - Logo y datos del emisor (desde `arca_config`)
  - Tipo y numero de comprobante (ej: "Factura B - 0007-00000001")
  - Datos del receptor (CUIT/DNI, razon social, condicion IVA, domicilio)
  - Detalle de conceptos con montos
  - Si es Factura A: desglose neto + IVA
  - CAE y fecha de vencimiento del CAE
  - Codigo QR con datos fiscales (como las facturas reales de AFIP)
  - Leyenda "DOCUMENTO NO FISCAL" (ya que estamos en sandbox)
- Botones: "Descargar PDF" e "Imprimir" (window.print)

### Integracion con el detalle del envio

**Archivo**: `src/components/shipments/ShipmentDetailsDialog.tsx`

Cuando el envio ya tiene factura emitida (tiene `factura_cae`), agregar un boton "Imprimir Factura" que abre `/print-invoice?id={envioId}` en nueva pestana.

---

## Parte 2: Pagina de impresion de Liquidaciones

### Nueva pagina: `src/pages/PrintSettlement.tsx`

Ruta: `/print-settlement?id={liquidacion_id}&type={branch|driver|seller}`

Contenido:
- Segun el `type`, consulta la tabla correspondiente (`liquidaciones`, `liquidacion_sucursales`, `seller_liquidaciones`)
- Carga los detalles asociados (comisiones, detalles de sucursal, movimientos de seller)
- Carga branding del tenant
- Muestra una vista previa imprimible con:
  - Logo y nombre de la empresa
  - Titulo: "LIQUIDACION DE SUCURSAL / CHOFER / SELLER"
  - Datos generales: entidad, periodo, estado, metodo de pago
  - Resumen de totales
  - Tabla de detalle de envios/movimientos
  - Pie con fecha de generacion
- Botones: "Descargar PDF" (reutiliza las funciones existentes de `generateSettlementPDF.ts`) e "Imprimir"

### Integracion con las paginas existentes

Agregar un boton "Imprimir" junto al boton de "Descargar PDF" existente en:

1. **`src/pages/DriverSettlements.tsx`**: Boton con icono de impresora al lado del Download
2. **`src/pages/BranchSettlements.tsx`**: Igual
3. **`src/pages/ecommerce/Settlements.tsx`**: Igual para liquidaciones de seller
4. **`src/components/settlements/SettlementDetailDialog.tsx`**: El boton "Imprimir" ya existe pero usa `window.print()` del dialog. Cambiar para abrir la pagina dedicada
5. **`src/components/ecommerce/SellerLiquidacionDetailDialog.tsx`**: Agregar boton "Imprimir" que abra la pagina

---

## Seccion Tecnica

### Nuevos archivos

| Archivo | Descripcion |
|---------|-------------|
| `src/pages/PrintInvoice.tsx` | Vista previa e impresion de factura electronica |
| `src/pages/PrintSettlement.tsx` | Vista previa e impresion de liquidaciones (branch/driver/seller) |

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Agregar rutas `/print-invoice` y `/print-settlement` |
| `src/components/shipments/ShipmentDetailsDialog.tsx` | Agregar boton "Imprimir Factura" cuando hay factura emitida |
| `src/pages/DriverSettlements.tsx` | Agregar boton "Imprimir" que abre `/print-settlement` |
| `src/pages/BranchSettlements.tsx` | Agregar boton "Imprimir" que abre `/print-settlement` |
| `src/pages/ecommerce/Settlements.tsx` | Agregar boton "Imprimir" que abre `/print-settlement` |
| `src/components/settlements/SettlementDetailDialog.tsx` | Actualizar boton "Imprimir" para abrir pagina dedicada |
| `src/components/ecommerce/SellerLiquidacionDetailDialog.tsx` | Agregar boton "Imprimir" |

### Patron de diseño

Ambas paginas siguen el mismo patron que `PrintReceipt.tsx`:
- Fondo gris claro (`bg-slate-100`)
- Card centrada con max-width
- Header con boton "Volver" y botones de accion
- Contenido formateado para impresion
- CSS `@media print` para ocultar botones y maximizar el contenido

### Consultas de base de datos

**PrintInvoice**:
- `facturas` (por `envio_id`) - datos fiscales del comprobante
- `envios` con joins a `clientes` y `sucursales` - datos del envio
- `envio_detalles` - conceptos facturados
- `arca_config` (por `tenant_id`) - datos del emisor
- `tenant_branding` - logo y nombre

**PrintSettlement**:
- Segun tipo, consulta la liquidacion principal
- Detalles/comisiones asociados
- `tenant_branding` - logo y nombre
