

# Fix: Logo SVG + Impresion desde iframe

## Problema 1: Logo no aparece

El logo del tenant es un archivo **SVG** (`logo-light.svg`). La libreria jsPDF solo soporta formatos raster (PNG, JPEG, GIF). Al llamar `doc.addImage(svgBase64, 'PNG', ...)` falla silenciosamente porque el contenido no es PNG. El fallback local (`geologistick-logo.png`) tampoco aparece, probablemente porque el `catch` en `loadImageAsBase64` captura el error pero `addImage` tambien falla si el base64 no tiene el formato esperado.

### Solucion

Convertir cualquier imagen (incluido SVG) a PNG usando un `<canvas>` antes de insertarla en el PDF:

1. Crear un elemento `Image()` con la URL
2. Dibujarlo en un `<canvas>` oculto
3. Extraer el canvas como `toDataURL('image/png')`
4. Usar ese PNG base64 en `doc.addImage()`

Nueva funcion `loadImageAsPngBase64`:

```typescript
async function loadImageAsPngBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 300;
      canvas.height = img.naturalHeight || 150;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
```

Reemplazar `loadImageAsBase64` por `loadImageAsPngBase64` para la carga del logo (tanto el del tenant como el fallback). Mantener `loadImageAsBase64` con fetch para el QR que ya viene en formato PNG.

## Problema 2: No imprime (window.open bloqueado)

La app corre dentro del iframe de preview de Lovable. Los navegadores bloquean `window.open()` desde iframes por seguridad. Tambien el `a.click()` para descarga puede no funcionar correctamente.

### Solucion

Usar `doc.save('nombre.pdf')` de jsPDF en vez de crear un enlace manualmente. `doc.save()` usa internamente `FileSaver` / `Blob` + `URL.createObjectURL` de una manera mas compatible con iframes. Eliminar `window.open()` ya que es redundante y se bloquea.

```typescript
// Reemplazar todo el bloque de descarga + window.open por:
doc.save(`etiqueta-${envio.tracking_number}.pdf`);
toast.success('PDF descargado. Abra el archivo para imprimir.');
```

## Resumen de cambios en `src/pages/PrintLabel.tsx`

1. **Nueva funcion** `loadImageAsPngBase64` que convierte cualquier imagen (SVG, PNG, JPEG) a PNG base64 via canvas
2. **handlePrint**: Usar `loadImageAsPngBase64` para cargar el logo (lineas 468-471)
3. **handlePrint**: Reemplazar el bloque de descarga manual + `window.open` (lineas 500-510) por `doc.save()`
4. **Vista previa HTML** (linea 640-644): Agregar fallback al logo local tambien en la preview

