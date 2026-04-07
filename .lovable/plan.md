

## Plan: Fix global scroll en desktop y páginas de impresión

### Causa raíz
En `src/index.css` líneas 246-252, `html` y `body` tienen:
- `overflow: hidden` — bloquea todo scroll
- `position: fixed` — impide scroll nativo del documento

Esto fue pensado para la APK móvil (evitar bounce/overscroll), pero rompe el scroll en escritorio y en todas las páginas de impresión (PrintRouteSheet, PrintLabel, PrintInvoice, etc.).

### Solución
Aplicar `overflow: hidden` y `position: fixed` **solo en plataformas nativas** (Capacitor), no globalmente. En web desktop estas propiedades no deben existir.

### Cambios

**1. `src/index.css`** — Condicionar estilos al contexto nativo:

```css
@layer base {
  html, body {
    height: 100%;
    width: 100%;
    background-color: hsl(var(--background));
  }

  /* Solo en APK nativa: bloquear scroll del body */
  html.native-app, html.native-app body {
    overflow: hidden;
    position: fixed;
  }

  #root {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
  }

  /* En nativa, aplicar safe-area padding */
  html.native-app #root {
    padding-top: env(safe-area-inset-top, 40px) !important;
    padding-bottom: env(safe-area-inset-bottom, 40px) !important;
  }

  main {
    flex: 1;
    overflow-y: auto;
  }

  /* FIX CÁMARA TRANSPARENTE */
  html.barcode-scanner-active,
  body.barcode-scanner-active {
    background: transparent !important;
  }
  body.barcode-scanner-active #root {
    visibility: hidden !important;
  }
}
```

**2. `src/main.tsx`** — Agregar clase `native-app` al `<html>` cuando corre en Capacitor:

Agregar al inicio (antes de `ReactDOM.createRoot`):
```typescript
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('native-app');
}
```

### Resultado
- **Desktop web**: scroll normal en todas las páginas, incluyendo impresión
- **APK nativa**: mantiene el comportamiento actual (overflow hidden + safe areas)
- **Páginas de impresión**: funcionan correctamente con scroll nativo

### Archivos a modificar
- `src/index.css` — Condicionar overflow/position a `.native-app`
- `src/main.tsx` — Detectar plataforma nativa y agregar clase

