

# Fix: Textos invisibles en paginas de impresion (dark mode)

## Problema

Cuando el usuario tiene el tema oscuro activado, todas las paginas de impresion HTML muestran el texto casi invisible. Esto ocurre porque:

- El body hereda `text-foreground` del tema activo
- En dark mode, `--foreground` es `hsl(214 32% 95%)` (casi blanco)
- Las paginas de impresion fuerzan `bg-white`, pero el texto sigue siendo claro
- Resultado: texto blanco sobre fondo blanco = ilegible

La captura del usuario en `PrintPlannedRoute` lo confirma: "HOJA DE RUTA", datos de ruta, chofer, y paradas estan practicamente invisibles.

## Paginas afectadas

| Pagina | Tipo de impresion | Afectada |
|--------|-------------------|----------|
| `PrintPlannedRoute.tsx` | HTML directo | Si (confirmado por screenshot) |
| `PrintRouteSheet.tsx` | HTML directo | Si |
| `PrintInvoice.tsx` | HTML + html2canvas | Si (html2canvas captura colores dark) |
| `PrintSettlement.tsx` | HTML + jsPDF download | Si (vista previa en pantalla) |
| `PrintReceipt.tsx` | HTML + jsPDF download | Si (vista previa en pantalla) |
| `PrintLabel.tsx` | Solo jsPDF nativo | No (genera PDF sin DOM) |

## Solucion

### 1. Agregar regla CSS global para forzar colores claros en impresion

**Archivo:** `src/index.css`

Agregar una regla `@media print` que sobreescriba las variables CSS del dark mode con los valores del tema claro:

```css
@media print {
  :root, .dark {
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;
    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 222 47% 11%;
    --muted: 214 32% 95%;
    --muted-foreground: 215 16% 47%;
    --border: 214 32% 91%;
    --secondary: 214 32% 91%;
    --secondary-foreground: 222 47% 11%;
  }
}
```

Esto aplica a todas las paginas de impresion automaticamente sin tocar cada archivo individual.

### 2. Forzar colores en el contenedor de PrintPlannedRoute

**Archivo:** `src/pages/PrintPlannedRoute.tsx`

Agregar `text-black` al contenedor raiz para redundancia, asegurando que la hoja impresa use texto negro explicitamente:

```tsx
<div className="min-h-screen bg-white text-black p-4 print:p-2">
```

### 3. Forzar colores en PrintRouteSheet

**Archivo:** `src/pages/PrintRouteSheet.tsx`

Agregar `text-black` al contenedor `.print-content`:

```tsx
<div className="print-content bg-white text-black p-8 max-w-4xl mx-auto">
```

### 4. Forzar colores en PrintInvoice (critico para html2canvas)

**Archivo:** `src/pages/PrintInvoice.tsx`

El `html2canvas` captura los colores del DOM en el momento. Si el usuario esta en dark mode, el PDF tambien saldra con colores claros. Agregar clase explicita:

```tsx
<Card id="invoice-print-area" className="shadow-lg print:shadow-none print:border-0 bg-white text-black [&_*]:text-black [&_.text-muted-foreground]:!text-gray-500">
```

Alternativa mas limpia: antes de capturar con html2canvas, aplicar temporalmente la clase `light` al documento y removerla despues.

### 5. Forzar colores en PrintSettlement y PrintReceipt

**Archivos:** `src/pages/PrintSettlement.tsx`, `src/pages/PrintReceipt.tsx`

Aplicar `text-black` a los contenedores principales de la Card visible.

## Resumen de archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/index.css` | Regla `@media print` global con variables light mode |
| `src/pages/PrintPlannedRoute.tsx` | `text-black` en contenedor |
| `src/pages/PrintRouteSheet.tsx` | `text-black` en contenedor |
| `src/pages/PrintInvoice.tsx` | Forzar tema claro antes de html2canvas |
| `src/pages/PrintSettlement.tsx` | `text-black` en Card |
| `src/pages/PrintReceipt.tsx` | `text-black` en Card |

## Sin cambios de base de datos

No se requieren migraciones.
