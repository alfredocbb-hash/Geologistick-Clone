

# Mejorar PDFs de Reportes con Graficos

## Problema actual
Los PDFs exportados solo contienen tablas de texto plano, sin graficos ni formato profesional. No aprovechan los helpers existentes en `pdfHelpers.ts` (portada, headers, footers con logo).

## Solucion

Capturar los graficos `recharts` del DOM como imagenes (via `canvas.toDataURL`) e incrustarlos en el PDF junto con las tablas, usando el sistema profesional de `pdfHelpers.ts`.

## Cambios por archivo

### `src/pages/Reports.tsx`

1. **Reemplazar `exportTabToPDF`** por una funcion asincrona `exportReportPDF` que:
   - Cargue el logo con `loadLogoAsBase64()`
   - Dibuje portada profesional con `drawCoverPage()` (titulo del tab, periodo seleccionado)
   - Para cada seccion del tab activo:
     - Capture el grafico del DOM usando `html2canvas` sobre el contenedor del `ResponsiveContainer`
     - Inserte la imagen del grafico en el PDF con `doc.addImage()`
     - Dibuje la tabla de datos debajo con formato profesional (colores alternos, bordes, headers con fondo azul)
   - Agregue header y footer en cada pagina con `addPageHeader()` / `addPageFooter()`

2. **Agregar `ref`s** a los contenedores de graficos para poder capturarlos:
   - `sucursalesChartRef`, `destinosChartRef`, `choferesChartRef`, `evolucionChartRef`, `estadosChartRef`

3. **Cada boton "Exportar PDF"** llamara a la nueva funcion pasando el ref del grafico correspondiente y los datos del tab

### Nueva dependencia: `html2canvas`
- Se necesita instalar `html2canvas` para convertir los elementos SVG de recharts a imagenes rasterizadas que jsPDF pueda incrustar

### Estructura del PDF generado por tab

**Tab Sucursales:**
- Pagina 1: Portada profesional con logo, titulo "Envios por Sucursal", periodo
- Pagina 2: Imagen del grafico de barras horizontales + tabla con colores alternos

**Tab Destinos:**
- Pagina 1: Portada
- Pagina 2: Grafico de barras de ciudades + tabla de destinos

**Tab Choferes:**
- Pagina 1: Portada
- Pagina 2: Grafico comparativo + tabla ranking

**Tab Resumen General:**
- Pagina 1: Portada
- Pagina 2: KPIs en recuadros + grafico de evolucion diaria + grafico circular de estados

### Detalles de la tabla profesional en PDF
- Header de tabla con fondo azul (59, 130, 246) y texto blanco
- Filas con colores alternos (blanco / gris claro)
- Columnas alineadas segun tipo (texto a la izquierda, numeros a la derecha)
- Bordes sutiles entre filas
- Badge de efectividad simulado con rectangulo coloreado (verde >= 80%, amarillo >= 50%, rojo < 50%)

### Flujo tecnico de captura de graficos

1. El usuario hace click en "Exportar PDF"
2. Se obtiene el elemento DOM del grafico via `ref.current`
3. Se usa `html2canvas(element)` para renderizar a canvas
4. Se extrae `canvas.toDataURL('image/png')`
5. Se inserta en el PDF con `doc.addImage(dataUrl, 'PNG', x, y, width, height)`
6. Se calcula el ancho proporcional para mantener el aspect ratio dentro de los margenes del PDF

