

## Fix: OCR se queda colgado en "Procesando..." después de tomar foto

### Causa raíz
`createWorker('spa')` de tesseract.js v7 descarga ~15MB de archivos WASM + datos de idioma desde CDN. En WebViews móviles esto puede colgar indefinidamente — el Promise no resuelve ni rechaza, dejando al usuario en el spinner eterno.

### Solución
Agregar un **timeout de 30 segundos** al proceso OCR completo. Si se excede, cancelar el worker y ofrecer al usuario la opción de **ingresar los datos manualmente** (sin OCR). Además, agregar mensajes de progreso para que el usuario sepa qué está pasando.

### Cambios en `src/components/mobile/OCRCaptureDialog.tsx`

**1. Timeout en `processImage`**
```tsx
const processImage = async (dataUrl: string) => {
  setStep('processing');
  setImageData(dataUrl);
  
  let worker: any = null;
  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('TIMEOUT')), 30000)
  );
  
  try {
    const { createWorker } = await import('tesseract.js');
    setProgressMsg('Iniciando motor OCR...');
    
    const ocrProcess = async () => {
      worker = await createWorker('spa');
      setProgressMsg('Analizando imagen...');
      const { data } = await worker.recognize(dataUrl);
      await worker.terminate();
      return data.text;
    };
    
    const rawText = await Promise.race([ocrProcess(), timeout]);
    // ... parse and set fields
    setStep('confirm');
  } catch (error) {
    worker?.terminate?.().catch(() => {});
    
    if (error.message === 'TIMEOUT') {
      toast.warning('OCR tardó demasiado. Ingresá los datos manualmente.');
      setStep('confirm'); // Ir a confirm con campos vacíos para editar
    } else {
      toast.error('Error OCR', { description: error.message });
      setStep('capture');
    }
  }
};
```

**2. Mensaje de progreso dinámico**
- Agregar estado `progressMsg` que muestra "Descargando motor OCR...", "Analizando imagen..." en el paso `processing`
- Reemplazar el texto fijo "Analizando etiqueta con OCR..." por el mensaje dinámico

**3. Botón "Saltar OCR" durante el procesamiento**
- En el paso `processing`, agregar un botón "Ingresar manualmente" que permite al usuario saltar directamente al paso `confirm` con campos vacíos si no quiere esperar

### Archivo a modificar
- `src/components/mobile/OCRCaptureDialog.tsx`

