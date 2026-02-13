

# Etiquetas en esquina superior izquierda (multi-label por hoja A4)

## Problema

Actualmente cada etiqueta se centra en la pagina y usa `page-break-after: always`, lo que fuerza 1 etiqueta por hoja. Cuando un envio tiene 4 bultos, se gastan 4 hojas A4 para etiquetas de 10x15cm que podrian caber varias en una sola hoja.

## Solucion

Posicionar las etiquetas en la esquina superior izquierda y eliminar el page-break forzado para que el navegador fluya las etiquetas naturalmente en la pagina. En A4 (210x297mm) caben 2 etiquetas de 10cm de ancho por fila y 2 filas de 15cm de alto = 4 etiquetas por hoja.

## Cambios en `src/pages/PrintLabel.tsx`

### 1. Body: quitar centrado (lineas 301-312)

Cambiar de `display: flex; justify-content: center; align-items: center` a un flujo normal alineado arriba a la izquierda:

```css
body {
  font-family: ...;
  background: white;
  margin: 0;
  padding: 0;
}
```

### 2. Label: quitar centrado y page-break forzado (lineas 314-329)

- Quitar `margin: 0 auto` (ya no se centra)
- Quitar `page-break-after: always` (ya no fuerza 1 por hoja)
- Agregar `display: inline-block` y `vertical-align: top` para que fluyan lado a lado
- Mantener `page-break-inside: avoid` para que una etiqueta no se corte entre paginas

```css
.label {
  width: ${size.width};
  height: ${size.height};
  max-height: ${size.height};
  background: white;
  box-sizing: border-box;
  overflow: hidden;
  display: inline-block;
  vertical-align: top;
  page-break-inside: avoid;
  margin: 0 2mm 2mm 0;
}
```

### 3. @media print: alinear arriba izquierda (lineas 536-557)

```css
@media print {
  html, body {
    width: 100%;
    height: auto;
    margin: 0;
    padding: 0;
  }
  .label {
    width: ${size.width};
    height: ${size.height};
    max-height: ${size.height};
    overflow: hidden;
    display: inline-block;
    vertical-align: top;
    margin: 0 2mm 2mm 0;
    page-break-inside: avoid;
  }
}
```

## Resultado esperado

En A4 con etiquetas compactas (10x15cm):

```text
+---------------------------+
| [Etiqueta 1] [Etiqueta 2] |
|                            |
| [Etiqueta 3] [Etiqueta 4] |
|                            |
+---------------------------+
```

- 1 bulto: 1 etiqueta arriba a la izquierda
- 2 bultos: 2 etiquetas en la misma fila
- 3-4 bultos: 2 filas, todas en 1 hoja
- 5+ bultos: se pasa a la segunda hoja automaticamente

