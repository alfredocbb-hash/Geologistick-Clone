

# Plan: Corregir Etiquetas de Impresión en Blanco

## Diagnóstico del Problema

El CSS de impresión tiene un selector incorrecto en la línea 401-404:

```css
body > *:not(.print-content) {
  display: none !important;
}
```

### ¿Por qué falla?
- En React, toda la app está dentro de `<div id="root">`
- La estructura real es: `body > #root > ... > .print-content`
- El selector busca hijos **directos** de body con clase `.print-content`
- Como `.print-content` no es hijo directo, TODO se oculta

---

## Solución

Modificar los estilos de impresión en `src/pages/PrintLabel.tsx` para usar una estrategia diferente:

### Cambios en el CSS (líneas 394-425):

**Antes:**
```css
@media print {
  /* Ocultar todo excepto contenido de impresión */
  body > *:not(.print-content) {
    display: none !important;
  }
  
  .no-print {
    display: none !important;
  }
  ...
}
```

**Después:**
```css
@media print {
  @page {
    size: A4 portrait;
    margin: 5mm;
  }
  
  /* Ocultar elementos que no se deben imprimir */
  .no-print,
  header,
  nav,
  footer,
  [data-radix-portal] {
    display: none !important;
  }
  
  /* Reset del body y html */
  html, body, #root {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    margin: 0 !important;
    padding: 0 !important;
    width: 210mm !important;
    background: white !important;
  }
  
  /* Asegurar que print-content sea visible */
  .print-content {
    display: block !important;
    visibility: visible !important;
    position: static !important;
    width: 200mm !important;
    padding: 0 !important;
    margin: 0 auto !important;
  }
  
  /* ... resto de estilos igual ... */
}
```

---

## Archivo a Modificar

| Archivo | Líneas | Cambio |
|---------|--------|--------|
| `src/pages/PrintLabel.tsx` | 394-425 | Reemplazar selector `body > *:not(.print-content)` por estrategia de clases específicas |

---

## Cambios Clave

1. **Eliminar** el selector problemático `body > *:not(.print-content)`
2. **Agregar** `#root` a los resets de html/body
3. **Usar** `.no-print` en elementos específicos en lugar de ocultar todo
4. **Asegurar** visibilidad explícita de `.print-content`

---

## Resultado Esperado

Las etiquetas se imprimirán correctamente mostrando:
- Información del envío
- Código QR
- Datos del remitente/destinatario
- Precio y tipo de pago

---

## Nota para el Usuario

Después de aplicar el cambio, al imprimir seleccione:
- **Escala**: 100% (no "Ajustar al ancho")
- **Márgenes**: Mínimo o Ninguno

