
# Plan: Corregir Estilos de Impresión para Etiquetas A4

## Diagnóstico del Problema

Mirando la **Foto 2**, las etiquetas:
- Aparecen en 1 sola página (no hay corte ✓)
- Pero están muy pequeñas/comprimidas
- El contenido no aprovecha el ancho de la hoja A4

### Causa Raíz

Los estilos de impresión actuales tienen estos problemas:

1. **`position: absolute`** en `.print-content` hace que pierda su flujo normal
2. **No hay ancho explícito** para las etiquetas - el navegador las comprime
3. **El `width: 100%`** en `.label-container` hereda de un contenedor colapsado

---

## Solución Propuesta

### Modificar los estilos `@media print` en `PrintLabel.tsx`

Cambiar la estrategia de posicionamiento para que las etiquetas ocupen correctamente el ancho de la hoja A4:

```css
@media print {
  @page {
    size: A4 portrait;
    margin: 5mm;
  }
  
  /* Ocultar todo excepto contenido de impresión */
  body > *:not(.print-content) {
    display: none !important;
  }
  
  .no-print {
    display: none !important;
  }
  
  html, body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    margin: 0 !important;
    padding: 0 !important;
    width: 210mm !important;  /* Ancho A4 */
  }
  
  /* Contenedor principal - REMOVER position: absolute */
  .print-content {
    position: static !important;
    width: 200mm !important;  /* A4 menos márgenes */
    padding: 0 !important;
    margin: 0 auto !important;
  }
  
  /* Grid a columna única */
  .print-content > div {
    display: flex !important;
    flex-direction: column !important;
    width: 200mm !important;
  }
  
  /* Cada etiqueta ocupa el ancho completo */
  .label-container {
    width: 200mm !important;
    min-width: 200mm !important;
    height: 90mm !important;
    max-height: 90mm !important;
    overflow: hidden !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    margin-bottom: 2mm !important;
    padding: 4mm !important;
    box-sizing: border-box !important;
    border: 1px solid black !important;
    background: white !important;
  }
  
  /* Salto de página cada 3 etiquetas */
  .label-container:nth-child(3n) {
    page-break-after: always !important;
    break-after: page !important;
    margin-bottom: 0 !important;
  }
  
  .label-container:last-child {
    page-break-after: auto !important;
  }
}
```

### Cambios Clave

| Cambio | Antes | Después |
|--------|-------|---------|
| `.print-content` posición | `position: absolute` | `position: static` |
| Ancho de etiquetas | `width: 100%` (relativo) | `width: 200mm` (absoluto) |
| Contenedor padre | Sin ancho definido | `width: 200mm` explícito |
| Margen | Centrado por defecto | `margin: 0 auto` |

---

## Archivo a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/PrintLabel.tsx` | Actualizar estilos `@media print` (líneas 394-514) |

---

## Resultado Esperado

Al imprimir desde Chrome/Edge:
- Cada etiqueta ocupará **200mm de ancho** (el ancho útil de A4 con márgenes de 5mm)
- Cada etiqueta tendrá **90mm de alto** fijo
- **3 etiquetas por página** sin cortes
- La vista previa mostrará etiquetas del mismo tamaño que en pantalla

---

## Tip Adicional para el Usuario

En el diálogo de impresión, asegurarse de tener:
- **Escala**: 100 (no "Ajustar al ancho")  
- **Tamaño de papel**: A4
- **Márgenes**: Mínimos o Ninguno (el CSS ya incluye los 5mm)

Esto garantizará que las etiquetas salgan exactamente como se ven en pantalla.
