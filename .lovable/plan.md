

# Plan: Mejoras en impresión de etiquetas

## Cambios en `src/pages/PrintLabel.tsx`

### 1. Logo más grande en vista previa
Línea 621: Cambiar `max-w-[80px] max-h-[40px]` a `max-w-full max-h-full w-full h-full` para que rellene el cuadrado.

### 2. Logo más grande en PDF
Líneas 180-182: Reducir márgenes de 4mm a 2mm:
```typescript
const logoMaxW = logoW - 2;
const logoMaxH = row1H - 2;
doc.addImage(logoBase64, 'PNG', lx + 1, y + 1, logoMaxW, logoMaxH);
```

### 3. Botón "Imprimir" directo
Agregar función `handleDirectPrint` que genera el PDF igual que `handlePrint` pero usa:
```typescript
doc.autoPrint();
const blobUrl = doc.output('bloburl');
window.open(blobUrl, '_blank');
```
Agregar botón con icono `Printer` junto al botón "Generar PDF".

### 4. Múltiples etiquetas en A4 (4 por hoja)
Cuando hay más de 1 bulto, generar el PDF en formato A4 (210x297mm) con 4 etiquetas por página distribuidas en grilla 2x2. Cada etiqueta se escala para caber en ~100x148mm dentro del A4 con márgenes.

**Lógica:**
- Si `bultos === 1`: PDF de una sola página 100x150mm (comportamiento actual).
- Si `bultos > 1`: PDF en A4, 4 etiquetas por página.
  - Posiciones: top-left `(5, 0.5)`, top-right `(107.5, 0.5)`, bottom-left `(5, 148.5)`, bottom-right `(107.5, 148.5)`.
  - Cada etiqueta se dibuja con `drawLabel()` usando offset de translate.
  - Nueva página cada 4 etiquetas.

**Implementación:** Modificar `handlePrint` y crear `handleDirectPrint` con esta lógica:
```typescript
if (bultos === 1) {
  // Single label page 100x150
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 150] });
  drawLabel(doc, ...);
} else {
  // A4 with 4 labels per page
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const positions = [
    { x: 5, y: 0.5 }, { x: 107.5, y: 0.5 },
    { x: 5, y: 148.5 }, { x: 107.5, y: 148.5 },
  ];
  for (let i = 0; i < bultos; i++) {
    if (i > 0 && i % 4 === 0) doc.addPage();
    const pos = positions[i % 4];
    // Save state, translate origin, draw label at offset
  }
}
```

`drawLabel` recibirá parámetros `offsetX` y `offsetY` opcionales para dibujar con desplazamiento dentro de la página A4.

## Archivo afectado

| Archivo | Cambio |
|---------|--------|
| `src/pages/PrintLabel.tsx` | Logo grande, botón imprimir, 4 etiquetas por A4 |

