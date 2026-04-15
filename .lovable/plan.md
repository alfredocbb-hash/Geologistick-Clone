

## Plan: Formulario de Emisión con Campos Completos Estilo AFIP

### Referencia
La factura de ejemplo (Correo Argentino, Factura A) muestra los campos AFIP estándar que faltan en el sistema actual.

### Campos a agregar

| Campo | Descripción | Origen en la factura |
|-------|-------------|---------------------|
| **Concepto** | Productos (1) / Servicios (2) / Ambos (3) | Implícito (servicios de flete) |
| **Período Facturado Desde/Hasta** | Fechas de servicio (obligatorio si concepto ≠ 1) | "01/03/2026 - 31/03/2026" |
| **Fecha Vto. Pago** | Vencimiento del pago (obligatorio si concepto ≠ 1) | "06/05/2026" |
| **Tipo Documento** | CUIT (80), DNI (96), Sin Identificar (99) | "CUIT: 30708574838" |
| **Condición de Venta** | Contado / Cuenta Corriente / etc. | "Cuenta Corriente" |
| **Líneas de detalle** | Código, Producto/Servicio, Cantidad, U. Medida, Precio Unit., % Bonif. | 3 líneas en el ejemplo |
| **Imp. No Gravado** | ImpTotConc | "0,00" |
| **Imp. Exento** | ImpOpEx | "0,00" |
| **Imp. Tributos** | ImpTrib | "0,00" |
| **Descripción** | Nota general de la factura | — |

### Cambios

**1. Migración SQL — Tabla `facturas`** (9 columnas nuevas):
- `concepto` (smallint, default 1)
- `fecha_servicio_desde` (date, nullable)
- `fecha_servicio_hasta` (date, nullable)
- `fecha_vto_pago` (date, nullable)
- `importe_no_gravado` (numeric, default 0)
- `importe_exento` (numeric, default 0)
- `importe_tributos` (numeric, default 0)
- `descripcion` (text, nullable)
- `tipo_documento` (smallint, default 80)
- `condicion_venta` (text, nullable)

**2. Migración SQL — Tabla `factura_detalles`** (nueva tabla para líneas):
- `id`, `factura_id` (FK), `codigo`, `descripcion`, `cantidad`, `unidad_medida`, `precio_unitario`, `bonificacion_pct`, `subtotal`, `alicuota_iva` (21, 10.5, 27, 5, 2.5, 0), `subtotal_con_iva`, `tenant_id`
- RLS: mismo tenant que la factura

**3. `src/components/invoicing/InvoiceDataDialog.tsx`** — Ampliar formulario:
- Select de Concepto (Productos/Servicios/Ambos)
- Fechas de servicio condicionales (solo concepto 2 o 3)
- Select Tipo Documento (CUIT/CUIL/CDI/DNI/Sin Identificar)
- Select Condición de Venta
- Tabla editable de líneas de detalle (agregar/quitar filas)
- Inputs para Imp. No Gravado, Exento y Tributos
- Recalculo automático: Total = Neto + IVA + No Gravado + Exento + Tributos
- Dialog más ancho (`sm:max-w-2xl`) con scroll

**4. `src/pages/Facturacion.tsx`** — Mismos campos en formulario manual/batch

**5. `supabase/functions/arca-factura/index.ts`** — Parametrizar SOAP:
- Aceptar `concepto`, fechas, importes adicionales, `tipo_documento` del body
- Reemplazar `<ar:Concepto>1</ar:Concepto>` por el valor dinámico
- Incluir `FchServDesde`, `FchServHasta`, `FchVtoPago` cuando concepto ≠ 1
- Usar `ImpTotConc`, `ImpOpEx`, `ImpTrib` reales en vez de 0
- Guardar los campos nuevos + insertar líneas en `factura_detalles`

**6. `src/pages/PrintInvoice.tsx`** — Vista previa/impresión:
- Mostrar tabla de líneas de detalle (como en la factura de ejemplo)
- Mostrar período facturado y fecha vto. pago
- Desglose de IVA por alícuota
- Condición de venta

### Lógica clave

```text
Si concepto = 2 o 3:
  → Mostrar fecha_desde, fecha_hasta, fecha_vto_pago (obligatorios)
  → SOAP incluye FchServDesde, FchServHasta, FchVtoPago

ImpTotal = ImpNeto + ImpIVA + ImpTotConc + ImpOpEx + ImpTrib

Tipo Documento: 80=CUIT, 86=CUIL, 87=CDI, 96=DNI, 99=Sin Identificar

Líneas de detalle: se guardan en factura_detalles, se muestran en PrintInvoice
(AFIP WSFEv1 NO recibe líneas individuales, solo totales — las líneas son para la vista)
```

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | 10 columnas en `facturas` + tabla `factura_detalles` |
| `src/components/invoicing/InvoiceDataDialog.tsx` | Formulario completo estilo AFIP |
| `src/pages/Facturacion.tsx` | Mismos campos en formulario manual |
| `supabase/functions/arca-factura/index.ts` | Parametrizar SOAP |
| `src/pages/PrintInvoice.tsx` | Tabla de detalle + campos nuevos |

