

## Fix: OCR no procesa la imagen — API de tesseract.js incompatible

### Problema
El código usa `Tesseract.recognize(dataUrl, 'spa', {...})` que era la API de tesseract.js v2. El proyecto tiene instalado **tesseract.js v7**, que eliminó esa función. En v5+ se debe usar `createWorker` + `worker.recognize()`. Por eso al tomar la foto no pasa nada — la llamada falla silenciosamente.

### Solución

**Archivo: `src/components/mobile/OCRCaptureDialog.tsx`**

Reemplazar el bloque de `processImage` que hace:
```tsx
const Tesseract = await import('tesseract.js');
const result = await Tesseract.recognize(dataUrl, 'spa', { logger: ... });
const rawText = result.data.text;
```

Por la API correcta de v7:
```tsx
const { createWorker } = await import('tesseract.js');
const worker = await createWorker('spa');
const { data } = await worker.recognize(dataUrl);
const rawText = data.text;
await worker.terminate();
```

Cambios clave:
- `createWorker('spa')` — crea el worker con el idioma español ya cargado
- `worker.recognize(dataUrl)` — procesa la imagen
- `worker.terminate()` — libera recursos después del OCR
- Se elimina el `logger` callback (no soportado en v7 de esta forma)

### Archivo a modificar
- `src/components/mobile/OCRCaptureDialog.tsx` — solo el bloque `processImage`

