
# Plan: Corregir Impresión de Etiquetas (3 por A4)

## Diagnóstico del Problema

Las etiquetas se cortan/parten entre páginas por dos razones principales:

### 1. La página está envuelta en DashboardLayout

En `App.tsx`, la ruta `/print-label` está dentro del layout con sidebar:

```tsx
// Línea 135
<Route path="/print-label" element={<DashboardLayout><PrintLabel /></DashboardLayout>} />
```

Esto causa que el sidebar, header y otros elementos **se impriman también**, desplazando el contenido de las etiquetas.

### 2. Las etiquetas no tienen altura fija

Sin una altura calculada correctamente para que 3 etiquetas quepan exactamente en el área imprimible de A4, el navegador las divide donde considera apropiado.

---

## Solución Propuesta

### Paso 1: Remover DashboardLayout de la ruta de impresión

Modificar `src/App.tsx` para que la página de etiquetas se renderice sin el layout:

```tsx
// Cambiar línea 135 de:
<Route path="/print-label" element={<DashboardLayout><PrintLabel /></DashboardLayout>} />

// A:
<Route path="/print-label" element={<PrintLabel />} />
```

Esto es consistente con `PrintRouteSheet` (línea 141) y `PrintPlannedRoute` (línea 142) que tampoco usan DashboardLayout.

---

### Paso 2: Actualizar estilos de impresión en PrintLabel.tsx

Implementar la estrategia probada de `PrintRouteSheet.tsx` que oculta todo excepto el contenido de impresión:

```css
@media print {
  @page {
    size: A4 portrait;
    margin: 5mm;
  }
  
  body * {
    visibility: hidden;
  }
  
  .print-content, .print-content * {
    visibility: visible;
  }
  
  .print-content {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
  }
}
```

---

### Paso 3: Calcular altura fija para 3 etiquetas por página

Una hoja A4 portrait tiene 297mm de alto. Con márgenes de 5mm arriba y abajo:

- Altura útil: 297 - 10 = **287mm**
- Altura por etiqueta: 287 / 3 = **~95mm**
- Con gap entre etiquetas: **90mm por etiqueta + 2.3mm de margen**

Aplicar altura fija a cada `.label-container`:

```css
.label-container {
  height: 90mm !important;
  max-height: 90mm !important;
  overflow: hidden !important;
  page-break-inside: avoid !important;
  break-inside: avoid !important;
}
```

---

### Paso 4: Agregar clase contenedora para print

Envolver las etiquetas en un div con clase `print-content` para la estrategia de visibilidad:

```tsx
<div className="print-content">
  <div className="grid grid-cols-1 ...">
    {labels.map(...)}
  </div>
</div>
```

---

## Resumen de Cambios

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Remover `DashboardLayout` de la ruta `/print-label` |
| `src/pages/PrintLabel.tsx` | Actualizar estilos `@media print` con estrategia de visibilidad |
| `src/pages/PrintLabel.tsx` | Agregar altura fija de 90mm por etiqueta |
| `src/pages/PrintLabel.tsx` | Agregar clase `print-content` al contenedor de etiquetas |

---

## Resultado Esperado

Al imprimir desde Chrome/Edge a 100%:
- 3 etiquetas completas por hoja A4
- Sin cortes ni particiones entre páginas
- Sin elementos del sidebar/header en la impresión
- Cada etiqueta mantiene todo su contenido visible (tracking, QR, destinatario, etc.)

---

## Sección Técnica

### Por qué la estrategia de visibilidad funciona mejor

La técnica de `visibility: hidden` en todo el body y luego `visible` solo en el contenido de impresión es más robusta que `display: none` porque:

1. **No afecta el layout**: `visibility: hidden` mantiene el espacio del elemento pero lo hace invisible
2. **Herencia selectiva**: Los hijos pueden anular con `visibility: visible`
3. **Posicionamiento absoluto**: Al usar `position: absolute` en el contenido de impresión, se desacopla completamente del flujo normal del documento

### Cálculo de altura para A4

```text
A4 Portrait: 210mm x 297mm

Con @page { margin: 5mm }:
- Ancho útil: 210 - 10 = 200mm
- Alto útil: 297 - 10 = 287mm

Para 3 etiquetas:
- 287mm / 3 = 95.67mm teórico
- 90mm práctico (dejando margen para separación visual)
```
