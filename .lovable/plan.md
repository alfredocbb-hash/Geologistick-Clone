

## Plan: Reporte Excel de envíos OCR con chofer y estado

### Cambio
Agregar un botón "Exportar OCR" en la página de Reportes que descargue un Excel con todos los envíos creados por OCR, incluyendo chofer asignado y estado actual.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Reports.tsx` | Agregar botón "Exportar OCR" + lógica de query y exportación |

### Columnas del Excel
1. Tracking Number
2. Fecha de creación
3. Módulo origen (album/burst/manual)
4. **Estado actual**
5. ML Shipment ID
6. Nombre destinatario
7. Dirección de entrega
8. Ciudad
9. Código Postal
10. Provincia
11. Teléfono destinatario
12. Nombre remitente
13. **Chofer asignado** (nombre + apellido del profile)
14. Cantidad bultos
15. Peso (kg)
16. Valor declarado
17. Precio total

### Lógica
1. Query `envios` filtrando `source_module LIKE 'bulk_ocr%'` + rango de fechas + tenant
2. Obtener IDs de choferes únicos y hacer query a `profiles` para nombres
3. Mapear chofer_id → nombre completo
4. Exportar con `exportToExcel()` existente

