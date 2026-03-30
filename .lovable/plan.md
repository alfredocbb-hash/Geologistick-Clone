

## Plan: Agregar fecha de envío + exportar como XLSX real

### Problema
1. Falta la columna "Fecha" en el reporte de Envíos (tabla y exports)
2. El Excel se exporta como CSV renombrado, lo que causa problemas visuales (caracteres, formato). Necesita ser un `.xlsx` real usando la librería `xlsx` que ya está instalada.

### Cambios

**1. `src/hooks/useReportsData.ts`** — Agregar `fecha` al query y al tipo
- Agregar `created_at` al select de la query `enviosDetalle`
- Agregar `fecha: string` al interface `EnvioDetalleRow`
- En el map, formatear `created_at` como fecha legible (dd/MM/yyyy) y asignarla al campo `fecha`

**2. `src/lib/exportExcel.ts`** — Reescribir para generar XLSX real
- Reemplazar la lógica CSV por la librería `xlsx` (ya instalada)
- Crear un workbook con sheet, aplicar headers en negrita, anchos de columna automáticos, y formato de moneda para columnas currency
- Exportar como `.xlsx` real con `XLSX.writeFile()`

**3. `src/pages/Reports.tsx`** — Agregar columna "Fecha" en tabla y exports
- Agregar `<TableHead>Fecha</TableHead>` y la celda correspondiente en cada fila
- Agregar columna `{ header: 'Fecha', key: 'fecha' }` en el export Excel
- Actualizar colSpan de totales de 4 a 5
- Actualizar colSpan del mensaje vacío de 9 a 10

**4. `src/lib/exportReportPDF.ts`** — Agregar columna Fecha al PDF
- Agregar "Fecha" a los headers de la tabla del caso `envios`
- Incluir `row.fecha` en las celdas

### Archivos a modificar
- `src/hooks/useReportsData.ts`
- `src/lib/exportExcel.ts`
- `src/pages/Reports.tsx`
- `src/lib/exportReportPDF.ts`

