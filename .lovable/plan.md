
# Fix: Escaneo masivo sin contador, sin sonido, sin boton de confirmar

## Diagnostico

Hay 3 problemas interrelacionados en el flujo de escaneo masivo (CollectScanScreen + QRScanner):

### 1. Sin sonido
El audio beep en QRScanner (linea 549 y 325) usa un base64 WAV truncado/invalido: `UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1f`. Este string es un header WAV incompleto que no produce sonido audible.

**Solucion**: Reemplazar el `new Audio(base64)` con un beep generado por AudioContext (oscillador), que es el mismo metodo que ya funciona en `MobileScanTab.playBeepSound()`.

**Archivo**: `src/components/qr/QRScanner.tsx` (lineas 325 y 549)
- Crear una funcion `playBeep()` con AudioContext oscillator
- Usarla en ambos lugares (native continuous mode linea 325 y web continuous mode linea 549)

### 2. Contador no se actualiza
En `CollectScanScreen.handleQRScanned`, el `scanSessionCount` solo se incrementa DESPUES de que `addPackageByTracking` (async) se resuelve. Si la llamada a la BD tarda, el badge de QRScanner no muestra el conteo.

**Solucion**: Incrementar `scanSessionCount` inmediatamente al escanear, independientemente del resultado async. El conteo refleja "escaneos realizados", no "paquetes agregados exitosamente".

**Archivo**: `src/components/mobile/CollectScanScreen.tsx` (linea ~48-60, funcion `handleQRScanned`)
- Mover `setScanSessionCount(prev => prev + 1)` al inicio de la funcion, antes de las llamadas async

### 3. Estado stale en escaneo rapido (paquetes no aparecen hasta reentrar)
`useCollectPackages.addPackageByTracking` usa `packages` del closure de `useCallback`. Cuando se escanean multiples paquetes rapidamente en modo continuo, cada llamada ve el mismo array `packages` (stale closure), causando que:
- Las verificaciones de duplicados fallen
- Los `setPackages(prev => [...prev, pkg])` se sobreescriban entre si

**Solucion**: Usar un `ref` para la verificacion de duplicados en lugar de leer del state directamente.

**Archivo**: `src/hooks/useCollectPackages.ts`
- Agregar `packagesRef` que siempre tenga el valor actual
- En `addPackageByTracking`, verificar duplicados contra `packagesRef.current` en vez de `packages`
- Eliminar `packages` de las dependencias del `useCallback` para evitar recreaciones innecesarias

---

## Resumen de cambios

| Archivo | Cambio |
|---------|--------|
| `src/components/qr/QRScanner.tsx` | Reemplazar base64 WAV roto con AudioContext beep |
| `src/components/mobile/CollectScanScreen.tsx` | Incrementar contador inmediatamente al escanear |
| `src/hooks/useCollectPackages.ts` | Usar ref para evitar stale closures en escaneo rapido |

## Sin cambios de base de datos
No se necesitan migraciones.
