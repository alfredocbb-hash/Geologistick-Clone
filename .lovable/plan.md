

# Imprimir etiquetas generando PDF con jsPDF

## Enfoque

Reemplazar toda la logica de impresion HTML (`window.print()`, iframes, divs ocultos) por generacion de un PDF nativo con **jsPDF** (ya instalado en el proyecto). El PDF se abre en una pestana nueva donde el usuario puede imprimir directamente desde el visor de PDF del navegador.

## Tamanos de pagina PDF

Cada etiqueta sera una pagina del PDF con las dimensiones exactas del tamano seleccionado:

- **Compacta**: 100mm x 150mm (vertical)
- **Estandar**: 150mm x 100mm (horizontal)
- **Grande**: 200mm x 100mm (horizontal)

Esto hace que el driver de la impresora reciba exactamente el tamano correcto sin escalar.

## Cambios en `src/pages/PrintLabel.tsx`

### 1. Nuevo import

Agregar `import { jsPDF } from 'jspdf'` al inicio del archivo.

### 2. Funcion `generateLabelPDF` (nueva)

Reemplaza a `generateLabelHTML` para la impresion. Dibuja cada bulto como una pagina del PDF usando las primitivas de jsPDF:

- **Celdas con fondo negro**: `doc.setFillColor(0,0,0)` + `doc.rect()` para headers
- **Texto blanco/negro**: `doc.setTextColor()` + `doc.text()`
- **Bordes de tabla**: `doc.setDrawColor(0)` + `doc.rect()`
- **QR**: Se obtiene la imagen del QR como base64 (fetch + blob + FileReader) y se inserta con `doc.addImage()`
- **Logo del tenant**: Igual, se carga como base64 y se inserta

La estructura visual replica la tabla actual:

```text
+----------------------------------+
| [Logo]  | Tracking + Fecha       |
|---------|------------------------|
| Doc.Cli | Bulto | Operat. | Peso |
|---------|-------|---------|------|
| SUC. DESTINO    | COD  | ZONA   |
| Nombre sucursal destino          |
|----------------------------------|
| * TIPO DE SERVICIO *             |
|----------------------------------|
| DESTINATARIO                     |
| Nombre - DNI                     |
| Direccion - Ciudad - Tel         |
|----------------------------------|
| OBSERVACIONES      |    [QR]    |
| Pago: $xxx         |            |
|----------------------------------|
| SUC. ORIGEN | Codigo - Nombre    |
|----------------------------------|
| REMITENTE                        |
| Nombre - Tel                     |
+----------------------------------+
```

### 3. Reemplazar `handlePrint`

```typescript
const handlePrint = async () => {
  if (!envio) return;
  setIsPrinting(true);

  try {
    // Cargar imagenes como base64
    const qrPromises = ...;  // fetch QR para cada bulto
    const logoBase64 = envio.logoUrl ? await loadImageAsBase64(envio.logoUrl) : null;

    // Crear PDF con tamano exacto de etiqueta
    const doc = new jsPDF({
      orientation: size.orientation,
      unit: 'mm',
      format: [size.widthMm, size.heightMm],
    });

    // Dibujar cada bulto como una pagina
    for (let i = 0; i < bultos; i++) {
      if (i > 0) doc.addPage();
      drawLabel(doc, envio, i + 1, bultos, ...);
    }

    // Abrir en pestana nueva
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
  } catch (e) {
    toast.error("Error al generar el PDF");
  } finally {
    setIsPrinting(false);
  }
};
```

### 4. Eliminar codigo muerto

- Quitar la funcion `generateLabelHTML` completa (ya no se usa para imprimir)
- Quitar la inyeccion de divs ocultos y estilos temporales
- **Mantener** `generateLabelHTML` solo si se usa en la vista previa del componente

### 5. Actualizar LABEL_SIZES

Agregar dimensiones en mm y orientacion para jsPDF:

```typescript
const LABEL_SIZES = {
  compact: { name: "Compacta (10x15 cm)", widthMm: 100, heightMm: 150, orientation: 'portrait', qrSize: 30 },
  standard: { name: "Estandar (15x10 cm)", widthMm: 150, heightMm: 100, orientation: 'landscape', qrSize: 35 },
  large: { name: "Grande (20x10 cm)", widthMm: 200, heightMm: 100, orientation: 'landscape', qrSize: 40 },
};
```

### 6. Texto del boton y ayuda

Cambiar "Imprimir" por "Generar PDF" y actualizar el texto de ayuda.

## Detalle tecnico: Carga de imagenes

Para insertar QR y logo en el PDF, se necesitan como base64. Se usara una funcion helper:

```typescript
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}
```

## Archivos modificados

- `src/pages/PrintLabel.tsx` (unico archivo)

## Resultado

- Click en "Generar PDF" abre una pestana con el PDF nativo
- El usuario imprime desde el visor de PDF del navegador (Ctrl+P o boton de impresora)
- El tamano de pagina del PDF coincide exactamente con la etiqueta
- Funciona con cualquier impresora sin problemas de senales perdidas

