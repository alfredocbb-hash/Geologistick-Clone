

## Plan: Revertir InvoiceDataDialog + Agregar pestaña "Emitir Factura" en Facturación

### Problema
Los campos AFIP completos (concepto, fechas servicio, líneas de detalle, etc.) se agregaron al `InvoiceDataDialog` (el dialog que se usa desde envíos/liquidaciones). El usuario quiere que ese dialog vuelva a ser simple, y que los campos AFIP completos estén en el módulo de Facturación como una opción nueva.

### Cambios

**1. Revertir `src/components/invoicing/InvoiceDataDialog.tsx`**
- Quitar los campos nuevos: concepto, condición de venta, fechas de servicio, tipo documento explícito, líneas de detalle, importes no gravado/exento/tributos, descripción
- Volver al formulario simple: tipo comprobante, condición IVA, CUIT (con auto-lookup), nombre, domicilio, importe total con toggle IVA
- Mantener el auto-lookup de CUIT (eso fue aprobado aparte)

**2. Agregar botón "Emitir Factura" en `src/pages/Facturacion.tsx`**
- En la pestaña "Emitidas", al lado de "Cargar Manual" y "Sincronizar desde AFIP", agregar un botón "Emitir Factura"
- Este botón abre un nuevo dialog con **todos** los campos AFIP completos:
  - Concepto (Productos/Servicios/Ambos)
  - Condición de Venta
  - Fechas de servicio (condicional)
  - Tipo Documento
  - Condición IVA + CUIT con auto-lookup
  - Nombre, Domicilio
  - Líneas de detalle (tabla editable usando `InvoiceLineItems`)
  - Importes: No Gravado, Exento, Tributos
  - Desglose automático (Neto + IVA + extras = Total)
  - Descripción/Observaciones
- Al emitir, llama a `arca-factura` con todos los campos AFIP

**3. Mantener sin cambios**
- `InvoiceLineItems.tsx` y `afipConstants.ts` — se siguen usando en el nuevo dialog de Facturación
- `supabase/functions/arca-factura/index.ts` — ya acepta los campos nuevos, no hay que revertir
- Migración SQL — las columnas ya están en la tabla, se usan desde Facturación

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/invoicing/InvoiceDataDialog.tsx` | Revertir a formulario simple (sin campos AFIP extendidos) |
| `src/pages/Facturacion.tsx` | Agregar botón "Emitir Factura" + dialog con campos AFIP completos |

