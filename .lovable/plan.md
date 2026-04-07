

## Plan: Fix de scroll en APK móvil

### Problema
El `<main>` en `MobileAppLayout.tsx` usa `min-h-screen` sin `overflow-y: auto`. Cuando el chofer tiene muchos envíos, el contenido excede la pantalla y no se puede hacer scroll.

### Solución
Cambiar el contenedor `<main>` para que sea scrolleable con altura fija calculada entre header y bottom nav.

### Cambio en `src/components/mobile/MobileAppLayout.tsx`

**Línea 258**: Reemplazar clases del `<main>`:
- De: `min-h-screen` 
- A: `overflow-y-auto` con height calculado via style

**Líneas 259-261**: Actualizar style para usar height fijo en vez de padding approach:
```
style={{
  paddingTop: isPulling ? '0' : 'calc(3.5rem + env(safe-area-inset-top, 0px) + 1rem)',
  paddingBottom: 'calc(1rem)',
  height: 'calc(100vh - 3.5rem - env(safe-area-inset-top, 0px) - 5.5rem - env(safe-area-inset-bottom, 0px))',
  marginTop: isPulling ? '0' : 'calc(3.5rem + env(safe-area-inset-top, 0px))',
}}
```

Esto asegura que el `<main>` ocupe exactamente el espacio entre el header fijo y el bottom nav, y permita scroll interno.

### Archivos a modificar
- `src/components/mobile/MobileAppLayout.tsx` — Corregir overflow del main container

