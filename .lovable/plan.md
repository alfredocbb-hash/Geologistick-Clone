## Problema

El diálogo "Factura Manual" (`EmitirFacturaDialog`) llama al edge function `arca-factura` **sin** enviar `envio_id`, `liquidacion_seller_id` ni `liquidacion_terciarizado_id`. La función exige obligatoriamente uno de esos tres (línea 1586), por lo que devuelve **400 "Se requiere envio_id, liquidacion_seller_id o liquidacion_terciarizado_id"** y el frontend muestra "Edge Function returned a non-2xx status code".

Además, cuando se envían `concepto`, `tipo_documento`, `condicion_venta`, `fecha_servicio_*`, `importe_no_gravado/exento/tributos`, `descripcion` y `line_items` desde la factura manual, el flujo principal **no los pasa** a `createFacturaRecord` ni a `emitirFacturaARCA` (solo el flujo de NC los considera). Esto hace que la factura manual se grabe sin esos datos y AFIP rechace o falten en el comprobante.

## Plan de corrección

### 1. Edge function `arca-factura` (flujo principal)
- Eliminar la validación que obliga a tener envío/liquidación. Permitir emisión "manual" sin asociación.
- Cuando no hay envío ni liquidación:
  - `total = importe_total` directamente del body (validar que sea > 0).
  - Saltar las consultas a `envios` / `liquidaciones_*`.
- Pasar al `createFacturaRecord` el objeto `extra` con: `concepto`, `tipo_documento`, `condicion_venta`, `fecha_servicio_desde/hasta`, `fecha_vto_pago`, `importe_no_gravado`, `importe_exento`, `importe_tributos`, `descripcion`.
- Para conceptos 2 (Servicios) y 3 (Productos y Servicios): si vienen `fecha_servicio_*` y `fecha_vto_pago`, incluirlos en el XML SOAP `FECAESolicitar` (campos `FchServDesde`, `FchServHasta`, `FchVtoPago` con formato `AAAAMMDD`).
- Pasar `importe_no_gravado` / `importe_exento` / `importe_tributos` al cálculo del XML (campos `ImpTotConc`, `ImpOpEx`, `ImpTrib`) y recalcular `ImpNeto = importe_total - IVA - no_gravado - exento - tributos` para que cuadre con AFIP.
- Persistir `line_items` (si vienen) en una columna JSONB `line_items` de `facturas` (agregar columna en migración).

### 2. Migración BD
- Agregar columna `line_items jsonb` a `facturas` (nullable). Esto permite que la factura impresa muestre el detalle.

### 3. Frontend `EmitirFacturaDialog.tsx`
- Sin cambios funcionales en la llamada (ya envía todo lo necesario).
- Mejorar mensaje de error mostrando el `data.error` real cuando exista, no solo el genérico.

### 4. Validaciones extra del edge function
- Si `concepto` ∈ {2,3} y faltan fechas servicio → 400 con mensaje claro.
- Si `importe_total <= 0` → 400.

## Archivos a modificar

- `supabase/functions/arca-factura/index.ts` (flujo principal de emisión + XML SOAP).
- `supabase/migrations/<nuevo>.sql` (columna `line_items jsonb` en `facturas`).
- (Opcional) `src/components/invoicing/EmitirFacturaDialog.tsx` para propagar error detallado.

## Resultado esperado

Desde "Facturación → Emitir Factura" se podrá emitir Factura A/B/C **manualmente** (sin envío/liquidación), con datos completos AFIP (concepto, fechas servicio, importes desglosados, ítems) y obtener CAE correctamente.
