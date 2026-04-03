

## Plan: Fix build errors + cámara trasera automática + geocodificación + botones en modo ráfaga

### Problemas a resolver

1. **Cámara trasera no se abre automáticamente** al entrar en modo álbum
2. **Geocodificación faltante**: los envíos creados por OCR no tienen coordenadas, por lo que "Planificar Ruta" no puede optimizar
3. **Modo ráfaga sin botones de acción**: cuando se usa el modo ráfaga (OCRCaptureDialog en continuousMode), no hay forma de ver paquetes guardados ni planificar ruta
4. **3 errores de build** existentes

### Cambios por archivo

**`src/components/mobile/BulkOCRScreen.tsx`**:
- `useEffect` que llama `startCamera()` automáticamente cuando `mode === 'album'`
- Después de cada OCR exitoso (tanto álbum como ráfaga), invocar `geocode-address` con la dirección obtenida y actualizar el envío con `destinatario_lat`/`destinatario_lng`
- Fix build: cambiar `d.trackingNumber` a `d.mlShipmentId` (línea 361)
- **Modo ráfaga**: cuando `mode === 'burst'`, mostrar un panel flotante debajo del OCRCaptureDialog con contador de paquetes guardados y botones "PLANIFICAR RUTA" / "FINALIZAR"
- Mostrar la lista de `packages` y `queue` como indicadores de progreso en modo ráfaga

**`src/components/mobile/OCRCaptureDialog.tsx`**:
- Agregar función `handleConfirm` que construye `OCRConfirmData` desde los campos del formulario (`direccion`, `localidad`, `codigoPostal`, `nombreDestinatario`) y llama `onConfirm(data)`, luego resetea al paso de captura

**`src/components/scan/CollectRouteSheetDialog.tsx`**:
- Eliminar prop `onCollect` del `QRScanner`
- Mover la lógica de `handleScannerCollect` al handler `onScan` (recibir un string individual y acumularlo)

### Flujo ráfaga corregido
```text
[OCRCaptureDialog continuo]
    ↓ cada foto procesada
[Panel flotante inferior]
  "3 paquetes guardados"
  [PLANIFICAR RUTA]  [FINALIZAR]
```

### Archivos a modificar
- `src/components/mobile/BulkOCRScreen.tsx` — Auto-cámara + geocodificación + panel ráfaga + fix tipo
- `src/components/mobile/OCRCaptureDialog.tsx` — Agregar `handleConfirm`
- `src/components/scan/CollectRouteSheetDialog.tsx` — Fix prop `onCollect`

