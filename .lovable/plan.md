

# Correcciones de impresion de etiquetas

## Problema

La etiqueta se imprime mal en A4: ocupa 3 hojas porque:
1. El CSS `@page { size: 15cm 10cm }` no es respetado por todos los navegadores/impresoras y el contenido se desborda en hojas A4
2. El QR de 150px es demasiado grande para el tamano de la etiqueta
3. No hay un contenedor que limite la altura del label al tamano declarado

## Solucion

### Archivo: `src/pages/PrintLabel.tsx`

### 1. Cambiar `@page` para soportar ambos escenarios (linea 296-299)

En vez de forzar un tamano de pagina custom, usar A4 con la etiqueta centrada y limitada en tamano:

```css
@page {
  size: auto;
  margin: 5mm;
}
```

Esto deja que el navegador use el tamano de papel configurado por el usuario (A4, carta, etc.) y la etiqueta se centra dentro.

### 2. Limitar dimensiones del `.label` (lineas 314-321)

Agregar `max-width` y `max-height` para que cada etiqueta quepa en una sola pagina. Tambien agregar `height` fijo basado en el tamano seleccionado:

```css
.label {
  width: ${size.width};
  height: ${size.height};
  max-width: 100%;
  overflow: hidden;
  margin: 0 auto;
  page-break-after: always;
  page-break-inside: avoid;
}
```

### 3. Reducir tamano del QR en el HTML de impresion (linea 521)

El QR de 150px es excesivo para una etiqueta de 10cm de alto. Reducir a un tamano proporcional al label:
- compact: `qrSize` en CSS limitado a `80px`
- standard: limitado a `100px`
- large: limitado a `120px`

Esto se logra cambiando las lineas 520-523:
```css
.qr-image {
  width: ${labelSize === 'compact' ? '80px' : labelSize === 'standard' ? '100px' : '120px'};
  height: ${labelSize === 'compact' ? '80px' : labelSize === 'standard' ? '100px' : '120px'};
}
```

Los valores de `LABEL_SIZES.qrSize` se mantienen para la URL del QR (resolucion de imagen) pero el CSS limita el tamano visual.

### 4. Forzar que cada etiqueta quepa en una pagina (lineas 531-543)

Mejorar los estilos de `@media print`:
```css
@media print {
  html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
  }
  .label {
    width: ${size.width};
    height: ${size.height};
    max-height: ${size.height};
    overflow: hidden;
    margin: 0 auto;
    page-break-after: always;
    page-break-inside: avoid;
  }
  .label:last-child {
    page-break-after: auto;
  }
}
```

### 5. Ajustar la tabla para que no desborde (lineas 327-336)

Agregar `table-layout: fixed` para que la tabla respete los limites:
```css
.label-table {
  width: 100%;
  border-collapse: collapse;
  border: 2px solid #000;
  table-layout: fixed;
}
```

### Resumen de cambios

Todos los cambios son en `src/pages/PrintLabel.tsx`:
- `@page`: de tamano fijo a `size: auto; margin: 5mm`
- `.label`: agregar `height`, `max-height`, `overflow: hidden`, `page-break-inside: avoid`
- `.qr-image`: reducir tamano visual de 150px a 100px (standard)
- `.label-table`: agregar `table-layout: fixed`
- `@media print`: reforzar limites de tamano y page-break

Con estos cambios cada etiqueta quedara contenida en una sola pagina, centrada, sin importar si el usuario imprime en A4, carta o papel de etiquetas.
