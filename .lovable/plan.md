
# Plan: Corregir Estilos de Impresión de Etiquetas

## Problemas Identificados

1. **Colores de fondo desaparecen**: Los badges con colores (verde, negro, violeta) no se imprimen porque los navegadores por defecto no imprimen fondos de color.
2. **QR diminuto**: El código QR tiene un tamaño fijo en píxeles (`size={64}`) que se reduce al imprimir.
3. **Cuadrícula no se mantiene**: Aunque hay estilos de grid, algunos navegadores requieren reforzar la propiedad `print-color-adjust`.
4. **Cortes de etiquetas**: Necesita reforzar `break-inside: avoid` en todos los elementos internos.

---

## Solución Propuesta

### Archivo: `src/pages/PrintLabel.tsx`

#### 1. Forzar colores de fondo en elementos específicos

Agregar estilos explícitos para todos los elementos con fondo de color:

```css
/* Forzar impresión de colores de fondo */
.label-container,
.label-container * {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  color-adjust: exact !important;
}

/* Badges y elementos con fondo de color */
.label-container [class*="bg-"] {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  color-adjust: exact !important;
}
```

#### 2. Escalar el QR a tamaño físico fijo

Cambiar el tamaño del QR en los estilos de impresión:

```css
/* QR Code a tamaño físico fijo */
.label-container svg[viewBox] {
  width: 25mm !important;
  height: 25mm !important;
  min-width: 25mm !important;
  min-height: 25mm !important;
}
```

#### 3. Reforzar ocultación de elementos no imprimibles

Agregar más selectores para asegurar que solo las etiquetas se imprimen:

```css
/* Ocultar todo excepto las etiquetas */
body > *:not(.print-content),
.no-print,
button,
select,
[data-radix-portal],
header,
nav,
footer,
.gradient-primary:not(.label-container *) {
  display: none !important;
  visibility: hidden !important;
}
```

#### 4. Reforzar break-inside en elementos internos

```css
/* Evitar cortes dentro de etiquetas */
.label-container,
.label-container > * {
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}
```

#### 5. Estilos específicos para el badge de servicio y bulto

Agregar reglas explícitas para preservar los colores de los badges:

```css
/* Preservar colores del badge de tipo de servicio */
.label-container .bg-primary,
.label-container .bg-success,
.label-container .bg-warning,
.label-container .bg-accent {
  background-color: inherit !important;
  -webkit-print-color-adjust: exact !important;
}

/* Preservar el badge negro de BULTO */
.label-container .bg-foreground {
  background-color: #1e293b !important;
  color: white !important;
}
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/PrintLabel.tsx` | Actualizar bloque `<style>` con las mejoras de impresión |

---

## Cambios Específicos en el CSS de Impresión

### Bloque @media print actualizado:

```css
@media print {
  @page {
    size: A4 landscape;
    margin: 5mm;
  }
  
  /* NUEVO: Forzar impresión de colores */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  
  /* NUEVO: Ocultar header, botones, navegación */
  .no-print,
  header,
  nav,
  footer,
  button,
  select,
  [data-radix-portal],
  .min-h-screen > div:first-child {
    display: none !important;
    visibility: hidden !important;
  }
  
  /* Container principal */
  .print-content {
    display: block !important;
  }
  
  .print-content > div {
    display: grid !important;
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 3mm !important;
  }
  
  /* NUEVO: QR a tamaño físico */
  .label-container svg {
    width: auto !important;
    height: auto !important;
  }
  
  .label-container .flex.justify-center.mb-2 svg {
    width: 25mm !important;
    height: 25mm !important;
  }
  
  /* NUEVO: Evitar cortes */
  .label-container {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
  
  /* NUEVO: Colores específicos para badges */
  .label-container .bg-foreground {
    background-color: #1e293b !important;
    color: white !important;
  }
  
  .label-container .bg-success {
    background-color: #16a34a !important;
    color: white !important;
  }
  
  .label-container .bg-primary {
    background-color: #3b82f6 !important;
    color: white !important;
  }
  
  .label-container .bg-warning {
    background-color: #f59e0b !important;
    color: white !important;
  }
  
  .label-container .bg-accent {
    background-color: #8b5cf6 !important;
    color: white !important;
  }
}
```

---

## Resultado Esperado

| Problema | Antes | Después |
|----------|-------|---------|
| Colores de fondo | Desaparecen | Verde, negro, azul visibles |
| Tamaño del QR | Diminuto (64px) | 2.5cm fijo |
| Cuadrícula | Se rompe | Grid 2×3 o 3×2 mantenido |
| Cortes de página | Etiquetas cortadas | Cada etiqueta íntegra |
