

## Plan: Botón de contador visible en el escáner QR (modo continuo)

### Problema
En modo continuo (Flex, Flex Mixto, Colecta), cuando se escanean más de ~10 paquetes, el badge del contador en el header se pierde visualmente y el chofer solo puede cerrar con la X pequeña en la esquina. Falta un botón grande y accesible para cerrar el escáner y volver a la lista.

### Solución
Agregar un **botón flotante fijo en la parte inferior** del escáner QR cuando está en `continuousMode` y hay paquetes escaneados. Este botón:

- Se muestra siempre visible en la parte inferior de la pantalla
- Muestra el contador: **"LISTO · 15 paquetes ✓"**
- Al tocarlo, cierra el escáner (mismo que `onClose`)
- Usa colores llamativos (verde/primary) para que sea fácil de encontrar
- Se agranda visualmente cuando `scannedCount > 0`

### Archivo a modificar
- `src/components/qr/QRScanner.tsx`

### Cambios específicos

**1. Botón flotante inferior** (antes del cierre del div principal, ~línea 893):
```tsx
{continuousMode && scannedCount > 0 && (
  <div className="p-4 bg-black/80 safe-area-bottom">
    <Button
      onClick={handleClose}
      className="w-full h-14 text-lg font-bold gap-3 bg-gradient-to-r from-emerald-600 to-emerald-500"
    >
      <Package className="h-5 w-5" />
      LISTO · {scannedCount} paquete{scannedCount !== 1 ? 's' : ''} ✓
    </Button>
  </div>
)}
```

**2. Header badge**: Mantener el badge existente pero sin `animate-pulse` (distrae) y con `flex-shrink-0` para que no se comprima en pantallas chicas.

