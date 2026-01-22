

# Plan: Mejorar Sistema de Impresión de Etiquetas

## Problema Identificado

El enfoque actual de impresión tiene varios problemas:

1. **Usa `window.print()` directamente** sobre componentes React, lo cual causa problemas de renderizado
2. **CSS de impresión incrustado** tiene conflictos con estilos de Tailwind
3. **Componentes SVG de QR** pueden no renderizar correctamente en impresión
4. **Variables CSS de Tailwind** (como `bg-foreground`) no se traducen bien a impresión

## Solución: Adoptar el Enfoque de Ventana Nueva

Siguiendo el patrón del código de referencia, cambiaremos a abrir una **ventana nueva con HTML estático puro** para la impresión.

---

## Cambios Técnicos

### Archivo: `src/pages/PrintLabel.tsx`

#### 1. Agregar Selector de Tamaño de Etiqueta

```typescript
const labelSizes = {
  compact: {
    name: "Compacta (10×15 cm)",
    width: "10cm",
    height: "15cm",
    qrSize: 80,
  },
  standard: {
    name: "Estándar (15×10 cm)",
    width: "15cm", 
    height: "10cm",
    qrSize: 100,
  },
  large: {
    name: "Grande (20×10 cm)",
    width: "20cm",
    height: "10cm",
    qrSize: 120,
  },
};
```

#### 2. Cambiar QR de SVG a Imagen Externa

```typescript
// En lugar de QRCodeSVG
const getQRCodeUrl = (data: string, size: number) => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(data)}&format=png&margin=3&ecc=M`;
};
```

#### 3. Nueva Función `handlePrint` con Ventana Nueva

```typescript
const handlePrint = () => {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) {
    toast.error("Por favor permite ventanas emergentes para imprimir");
    return;
  }

  const labelHTML = generateLabelHTML(envio, labels, labelSize, tipoConfig);
  printWindow.document.write(labelHTML);
  printWindow.document.close();
  
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };
};
```

#### 4. Generar HTML Estático con CSS Inline

La función `generateLabelHTML()` creará:

- Documento HTML completo con `<!DOCTYPE html>`
- CSS de `@page` con dimensiones exactas
- Propiedades `print-color-adjust: exact` para colores
- HTML estructurado con estilos inline (sin Tailwind)
- Imágenes QR en lugar de SVG

---

## Estructura del HTML de Impresión

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Etiqueta - TRACKING</title>
  <style>
    @page {
      size: 15cm 10cm;
      margin: 0;
    }
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    /* Estilos específicos inline */
  </style>
</head>
<body>
  <!-- Etiquetas con HTML puro -->
</body>
</html>
```

---

## Flujo Visual Comparativo

```text
ANTES (Actual):                      DESPUÉS (Nuevo):
┌────────────────────┐              ┌────────────────────┐
│  Componentes React │              │  Preview React     │
│  + CSS @media print│              │  (solo visual)     │
│         ▼          │              │         ▼          │
│  window.print()    │              │  Botón Imprimir    │
│         ▼          │              │         ▼          │
│  Problemas de      │              │  window.open()     │
│  renderizado       │              │         ▼          │
└────────────────────┘              │  HTML Estático     │
                                    │  + CSS Inline      │
                                    │         ▼          │
                                    │  print() + close() │
                                    └────────────────────┘
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/PrintLabel.tsx` | Reescribir función de impresión para usar ventana nueva con HTML estático |

---

## Características del Nuevo Sistema

1. **Selector de tamaño de etiqueta**: Compacta, Estándar, Grande
2. **QR como imagen PNG**: Más compatible que SVG para impresión
3. **HTML estático puro**: Sin dependencia de Tailwind/React en impresión
4. **CSS inline**: Colores forzados con valores HEX directos
5. **Control de `@page`**: Tamaño exacto de etiqueta sin márgenes del navegador
6. **Carga de imagen antes de imprimir**: Espera a que el QR cargue antes de llamar `print()`

---

## Beneficios

| Aspecto | Antes | Después |
|---------|-------|---------|
| Compatibilidad | Variable entre navegadores | Consistente |
| Colores | Pueden fallar | Forzados con HEX |
| QR | SVG puede no renderizar | Imagen PNG garantizada |
| Tamaño | Depende de CSS @media | Definido en @page |
| Control | Limitado | Total sobre el HTML |

