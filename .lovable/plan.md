

## Plan: Pestaña "Envíos" en Reportes con Detalle Financiero + Export Excel/PDF

### Objetivo
Agregar una nueva pestaña **"Envíos"** en Reportes y Análisis con tabla detallada: seller/remitente, destinatario, localidad, importe, estado de liquidación, comisión del chofer, importe abonado, y diferencia (ganancia neta). Con descarga en Excel prolijo y PDF.

### Datos de la DB
- `envios`: `tracking_number`, `nombre_remitente`, `nombre_destinatario`, `ciudad_entrega`, `precio_total`, `estado`, `liquidacion_seller_id`, `chofer_id`
- `comisiones`: `envio_id`, `monto` (comisión chofer)
- `pagos`: `envio_id`, `monto`, `estado` (cobrado_chofer/rendido/pagado)
- `liquidaciones_seller`: `id`, `estado` → estado de liquidación

### Cambios

**1. `src/hooks/useReportsData.ts`** — Nueva query `enviosDetalle`
- Consulta `envios` del período con los campos necesarios
- Queries secundarias: `comisiones` (mapa envio→monto), `pagos` con estado in (cobrado_chofer, rendido, pagado) (mapa envio→monto), `liquidaciones_seller` para estado liquidación
- Retorna array con: tracking, remitente, destinatario, localidad, importe, estado_liquidacion, comision_chofer, importe_abonado, diferencia
- Totales agregados para KPIs

**2. `src/pages/Reports.tsx`** — Nueva pestaña "Envíos"
- Tab con icono `Package`, label "Envíos"
- 4 KPI cards: Total Envíos, Importe Total, Total Comisiones, Diferencia Neta
- Tabla con columnas: Tracking, Remitente, Destinatario, Localidad, Importe, Est. Liquidación, Comisión Chofer, Abonado, Diferencia
- Fila de totales
- Botón Excel: usa `exportToExcel` con columnas formateadas (currency para montos, text para el resto)
- Botón PDF: usa `exportReportPDF` con tab type `envios`
- Actualizar grid de tabs de 9 a 10 columnas

**3. `src/lib/exportReportPDF.ts`** — Soporte para tab `envios`
- Agregar `'envios'` al type del tab en `ReportExportOptions`
- Agregar case `envios` que renderiza tabla con las columnas del reporte

### Detalle del Excel
El Excel incluirá:
- Headers con nombres descriptivos en español
- Columnas de montos formateadas como currency ($)
- Fila de totales al final
- Formato limpio usando la función `exportToExcel` existente

### Archivos a modificar
- `src/hooks/useReportsData.ts`
- `src/pages/Reports.tsx`
- `src/lib/exportReportPDF.ts`

