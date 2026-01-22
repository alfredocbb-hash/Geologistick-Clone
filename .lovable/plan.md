
# Plan: Mejorar Impresión de Etiquetas para que Coincida con la Vista Previa

## Problema Actual

La vista previa muestra las etiquetas en un **grid de 3 columnas** (tarjetas compactas lado a lado), pero el CSS de impresión actual fuerza:
- Una sola columna vertical
- Cada etiqueta ocupa todo el ancho (200mm)
- 3 etiquetas por página en formato vertical

Esto hace que la impresión no coincida con lo que se ve en pantalla.

---

## Solución Propuesta: Selector de Formato de Impresión

Agregar un selector que permita elegir entre diferentes formatos de impresión:

### Opción 1: "Grid 2x3" (Horizontal - Recomendado)
- **Orientación**: A4 Horizontal (Landscape)
- **Disposición**: 2 columnas × 3 filas = 6 etiquetas por página
- **Tamaño etiqueta**: ~140mm × 90mm cada una
- **Ventaja**: Más cercano a la vista previa, aprovecha mejor el papel

### Opción 2: "Grid 3 columnas" (Horizontal)
- **Orientación**: A4 Horizontal (Landscape)
- **Disposición**: 3 columnas × 2 filas = 6 etiquetas por página
- **Tamaño etiqueta**: ~95mm × 140mm cada una
- **Ventaja**: Exactamente igual a la vista previa

### Opción 3: "Una columna" (Vertical - Actual)
- **Orientación**: A4 Vertical (Portrait)
- **Disposición**: 1 columna × 3 filas = 3 etiquetas por página
- **Tamaño etiqueta**: 200mm × 90mm cada una
- **Ventaja**: Etiquetas más grandes, mejor legibilidad

---

## Cambios Técnicos

### Archivo: `src/pages/PrintLabel.tsx`

1. **Agregar estado para formato seleccionado**
```tsx
const [printFormat, setPrintFormat] = useState<'grid-2x3' | 'grid-3x2' | 'single-column'>('grid-2x3');
```

2. **Agregar selector de formato en el header (no-print)**
```tsx
<Select value={printFormat} onValueChange={setPrintFormat}>
  <SelectItem value="grid-2x3">Grid 2×3 (Horizontal)</SelectItem>
  <SelectItem value="grid-3x2">Grid 3×2 (Horizontal)</SelectItem>
  <SelectItem value="single-column">Una columna (Vertical)</SelectItem>
</Select>
```

3. **CSS dinámico según el formato seleccionado**

**Para Grid 2×3 (Landscape):**
```css
@page { size: A4 landscape; margin: 5mm; }
.print-content > div {
  display: grid !important;
  grid-template-columns: repeat(2, 1fr) !important;
  gap: 3mm !important;
}
.label-container {
  width: 140mm !important;
  height: 90mm !important;
}
/* Salto de página cada 6 etiquetas */
.label-container:nth-child(6n) {
  page-break-after: always !important;
}
```

**Para Grid 3×2 (Landscape - igual a preview):**
```css
@page { size: A4 landscape; margin: 5mm; }
.print-content > div {
  display: grid !important;
  grid-template-columns: repeat(3, 1fr) !important;
  gap: 3mm !important;
}
.label-container {
  width: 95mm !important;
  height: 140mm !important;
}
```

4. **Aplicar clases condicionales al contenedor**
```tsx
<div className={cn("print-content p-4", `print-format-${printFormat}`)}>
```

5. **Generar estilos CSS condicionales**
```tsx
<style>{`
  @media print {
    ${printFormat === 'grid-2x3' ? gridStyles2x3 : 
      printFormat === 'grid-3x2' ? gridStyles3x2 : 
      singleColumnStyles}
  }
`}</style>
```

---

## Interfaz de Usuario

```text
┌─────────────────────────────────────────────────────────────┐
│ ← Imprimir Etiquetas                                        │
│   GEO-ABC123 • 4 bultos                                     │
│                                                             │
│   Formato: [Grid 2×3 (Horizontal) ▼]    [🖨️ Imprimir]      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                       │
│  │ Bulto 1 │ │ Bulto 2 │ │ Bulto 3 │  ← Vista previa       │
│  └─────────┘ └─────────┘ └─────────┘    adaptativa         │
│                                                             │
│  ┌─────────┐                                               │
│  │ Bulto 4 │                                               │
│  └─────────┘                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/PrintLabel.tsx` | Agregar estado, selector de formato, y CSS dinámico |

---

## Resultado Esperado

1. El usuario puede elegir el formato que mejor se adapte a sus necesidades
2. **Grid 2×3** será el valor por defecto (6 etiquetas por hoja horizontal)
3. **Grid 3×2** replica exactamente la vista previa de 3 columnas
4. **Una columna** mantiene el comportamiento actual para quienes lo prefieran
5. La vista previa se adapta al formato seleccionado antes de imprimir

---

## Nota Importante

Al imprimir, el usuario debe asegurarse de que la configuración del navegador coincida:
- **Para formatos horizontales**: Orientación "Horizontal/Landscape"
- **Escala**: 100%
- **Márgenes**: Mínimo o Ninguno
