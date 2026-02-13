

# Fix: Imprimir desde iframe oculto en vez de ventana nueva

## Problema

El metodo actual abre una ventana nueva con `window.open('', '_blank')` y llama `printWindow.print()`. Muchos navegadores y drivers de impresora no envian correctamente el trabajo de impresion desde ventanas popup. Guardar como PDF funciona porque el usuario controla el proceso manualmente.

## Solucion

Reemplazar `window.open` por un `<iframe>` oculto insertado en el DOM de la pagina actual. Los navegadores manejan `iframe.contentWindow.print()` de forma mucho mas confiable que popups.

## Cambios en `src/pages/PrintLabel.tsx`

### Reemplazar la funcion `handlePrint` (lineas 598-661)

En vez de abrir una ventana nueva:

```typescript
const handlePrint = () => {
  if (!envio) return;
  setIsPrinting(true);

  // ... misma logica de tipoConfig, getDeliveryAddress, generateLabelHTML ...

  // Crear iframe oculto
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc || !iframe.contentWindow) {
    toast.error("Error al preparar la impresion");
    setIsPrinting(false);
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(labelHTML);
  iframeDoc.close();

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        setIsPrinting(false);
      }, 1000);
    }, 500);
  };

  // Fallback de seguridad
  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
    setIsPrinting(false);
  }, 10000);
};
```

### Por que funciona

- Los navegadores tratan los iframes como parte del documento principal, no como popups
- El driver de impresora recibe la senal correctamente desde un iframe
- El iframe se elimina automaticamente despues de imprimir

### Sin otros cambios

- El HTML generado (`generateLabelHTML`) no cambia
- La vista previa no cambia
- La logica de datos no cambia

