## Objetivo
Incluir la **Localidad (ciudad de entrega)** en el detalle exportado de las liquidaciones de chofer y sucursal, tanto en PDF como en Excel.

## Cambios — `src/components/settlements/SettlementDetailDialog.tsx`

1. **Queries** (`branchDetalles` y `driverComisiones`): agregar `ciudad_entrega, direccion_entrega` al select de `envio:envios(...)`.

2. **Excel (`handleExportExcel`)**:
   - Agregar campo `localidad: envio?.ciudad_entrega || ''` al map de `data`.
   - Insertar columna `{ header: 'Localidad', key: 'localidad' }` después de "Destinatario", tanto para chofer como sucursal.

3. **PDF (`generatePDF`)**:
   - Reorganizar las columnas para hacer lugar a "Localidad":
     - Tracking (x=22), Fecha (x=60), Destinatario (x=85, ancho ~22 chars), Localidad (x=130, ancho ~18 chars), Monto (x=175).
   - Agregar header "Localidad" y celda con `envio?.ciudad_entrega || '-'` (truncado a 18 chars).

## Sin cambios
- Backend, RLS, lógica de cálculo, vista en pantalla del tab "Detalle de Envíos" (no fue solicitado).
- Si querés que también aparezca en la vista del diálogo, lo agrego como extensión.
