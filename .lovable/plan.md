

## Plan: Agregar fallback OCR al MLRegisterDialog en ScanQR y MobileScanTab

### Problema
El botón "Usar OCR (foto de etiqueta)" solo aparece en el módulo Flex Mixto porque es el único que pasa `onFallbackOCR` al `MLRegisterDialog`. En `/scan` (ScanQR) y en el tab de escaneo móvil (MobileScanTab), el prop no se pasa, así que cuando falla el registro ML (error 401), el chofer ve el error pero no tiene opción de OCR.

### Solución
Agregar el flujo OCR a los dos módulos que faltan, condicionado a que el tenant tenga `modo_flex_mixto` habilitado.

### Cambios

**1. `src/pages/ScanQR.tsx`**
- Importar `OCRCaptureDialog`
- Agregar estados: `showOCRCapture`, `pendingOCRShipmentId`
- Consultar `modo_flex_mixto` del tenant (ya se tiene acceso al tenant via `useTenant`)
- Crear `handleFallbackOCR`: cierra MLRegisterDialog, abre OCRCaptureDialog
- Crear `handleOCRConfirm`: llama a `addManualPackage` o crea el envío manual directamente
- Pasar `onFallbackOCR={handleFallbackOCR}` al `MLRegisterDialog` (solo si `modo_flex_mixto` está activo)
- Renderizar `OCRCaptureDialog`

**2. `src/components/mobile/MobileScanTab.tsx`**
- Mismos cambios: importar OCRCaptureDialog, estados, handler, pasar prop condicionalmente

### Detalle técnico

En ambos archivos, el patrón es idéntico:

```tsx
// Estado
const [showOCRCapture, setShowOCRCapture] = useState(false);
const [pendingOCRShipmentId, setPendingOCRShipmentId] = useState<string | null>(null);

// Handler
const handleFallbackOCR = () => {
  setPendingOCRShipmentId(pendingMLData?.mlShipmentId || null);
  setShowMLRegisterDialog(false);
  setPendingMLData(null);
  setShowOCRCapture(true);
};

// En MLRegisterDialog agregar:
onFallbackOCR={tenantData?.modo_flex_mixto ? handleFallbackOCR : undefined}

// Renderizar OCRCaptureDialog
<OCRCaptureDialog
  open={showOCRCapture}
  mlShipmentId={pendingOCRShipmentId || undefined}
  onClose={() => setShowOCRCapture(false)}
  onConfirm={handleOCRConfirm}
/>
```

El `handleOCRConfirm` creará el envío manual en la tabla `envios` con `is_manual_entry: true` y `source_module: 'scan_qr'` (o `'mobile_scan'`), usando la misma lógica que ya existe en `useFlexPackages.addManualPackage`.

### Archivos a modificar
- `src/pages/ScanQR.tsx`
- `src/components/mobile/MobileScanTab.tsx`

