

## Plan: Fix OCR feedback + Modo Escaneo Masivo OCR

### Problema 1: OCR no da feedback al confirmar
El `OCRCaptureDialog.handleConfirm` llama a `onConfirm()` sin esperar el resultado ni mostrar estado de carga. Si la inserción falla o tarda, el usuario no ve nada. El diálogo no se cierra solo porque el `onConfirm` async necesita completarse primero.

### Problema 2: Necesidad de escaneo masivo (600+ envíos)
El flujo actual es 1 foto → 1 confirmación → 1 envío. Para 600 paquetes de sellers no registrados, necesitan un modo batch donde se fotografíen etiquetas consecutivamente, se acumulen en una lista, y luego se asignen a choferes con optimización de rutas.

---

### Cambios

**1. `src/components/mobile/OCRCaptureDialog.tsx` — Fix feedback**
- Hacer `handleConfirm` async, mostrar spinner mientras `onConfirm` ejecuta
- Agregar estado `isConfirming` con Loader2 en el botón Confirmar
- Capturar errores del `onConfirm` y mostrar toast de error
- Después de éxito, resetear el estado y cerrar

**2. `src/components/mobile/OCRCaptureDialog.tsx` — Modo continuo**
- Agregar prop opcional `continuousMode?: boolean`
- En modo continuo, después de confirmar exitosamente: en vez de cerrar, volver al paso "capture" para tomar la siguiente foto
- Mostrar toast de éxito breve y un contador de paquetes escaneados en el header

**3. Nuevo: `src/components/mobile/BulkOCRScreen.tsx` — Pantalla de escaneo masivo**
- Pantalla fullscreen para escaneo masivo de etiquetas por OCR
- Usa `OCRCaptureDialog` en modo continuo internamente, o bien implementa el flujo inline (foto → OCR → confirm → siguiente)
- Muestra lista acumulada de paquetes escaneados con dirección y tracking
- Contador prominente: "X paquetes escaneados"
- Botones: "Optimizar y asignar rutas" → navega al planificador con los envíos pre-seleccionados
- Botón para exportar/ver lista de todos los escaneados
- Usa `useFlexPackages.addManualPackage` para cada paquete confirmado

**4. `src/components/mobile/FlexMixtoScreen.tsx` — Agregar acceso al modo masivo**
- Nuevo botón "Escaneo Masivo OCR" que abre `BulkOCRScreen`
- Visible cuando `modo_flex_mixto` está activo

**5. `src/pages/ScanQR.tsx` y `src/components/mobile/MobileScanTab.tsx` — Fix onConfirm**
- Envolver el `onConfirm` del OCRCaptureDialog para que devuelva una Promise y el diálogo pueda manejar el loading/error

### Flujo del escaneo masivo

```text
┌─────────────────────────┐
│   ESCANEO MASIVO OCR    │
│   0 paquetes            │
│                         │
│  ┌───────────────────┐  │
│  │  📷 TOMAR FOTO    │  │
│  └───────────────────┘  │
│                         │
│  (lista vacía)          │
│                         │
│  [Cancelar]             │
└─────────────────────────┘

    ↓ (toma foto, OCR, confirma)

┌─────────────────────────┐
│   ESCANEO MASIVO OCR    │
│   3 paquetes ✓          │
│                         │
│  ┌───────────────────┐  │
│  │  📷 SIGUIENTE     │  │
│  └───────────────────┘  │
│                         │
│  1. Av. San Martín 1234 │
│  2. Calle 45 N° 678     │
│  3. Belgrano 890        │
│                         │
│  [Ir al Planificador]   │
│  [Asignar a chofer]     │
└─────────────────────────┘
```

### Detalle técnico: OCRCaptureDialog con loading

```tsx
const [isConfirming, setIsConfirming] = useState(false);

const handleConfirm = useCallback(async () => {
  if (!direccion.trim()) {
    toast.error('La dirección es obligatoria');
    return;
  }
  setIsConfirming(true);
  try {
    await onConfirm({ ... });
    // En modo continuo: volver a capture
    if (continuousMode) {
      setStep('capture');
      setImageData(null);
      setOcrData(null);
      setDireccion(''); setLocalidad(''); // reset fields
    }
  } catch (err: any) {
    toast.error('Error al guardar', { description: err.message });
  } finally {
    setIsConfirming(false);
  }
}, [...]);
```

### Archivos a crear/modificar
- `src/components/mobile/OCRCaptureDialog.tsx` — fix feedback + modo continuo
- `src/components/mobile/BulkOCRScreen.tsx` — nueva pantalla masiva
- `src/components/mobile/FlexMixtoScreen.tsx` — botón acceso masivo
- `src/pages/ScanQR.tsx` — fix onConfirm para devolver Promise
- `src/components/mobile/MobileScanTab.tsx` — fix onConfirm para devolver Promise

