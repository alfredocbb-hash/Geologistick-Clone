

## Plan: Fix de cámara/galería y mejoras para la APK del chofer

### Parte 1: Fix del problema de cámara e imagen

**Problema identificado:** En la APK (Capacitor WebView), el hook `useNativePlatform` detecta correctamente que es nativo, pero el `useNativeCamera` hace un `dynamic import` de `@capacitor/camera` con `await import(...)`. En el contexto de un WebView cargando una URL remota (`server.url` apunta a `geologic.lovable.app`), el paquete `@capacitor/camera` NO está disponible en el bundle web — solo existe en el build nativo. Esto causa que el import falle silenciosamente y la cámara no funcione.

Para el fallback web (input file), los inputs con `capture="environment"` pueden no dispararse correctamente en algunos WebViews Android porque el click programático pierde el contexto de gesto del usuario dentro de un Dialog.

**Solución:**
1. **`src/hooks/useNativeCamera.ts`**: Agregar manejo robusto del error de import con fallback explícito. Si el import de `@capacitor/camera` falla, retornar `null` para que el componente use el fallback HTML. Agregar logs para diagnóstico.

2. **`src/components/delivery/DeliveryConfirmation.tsx`** y **`src/components/incidents/ReportIncidentDialog.tsx`**: 
   - Cuando `useNativeCamera` retorna `null` (import falló), forzar el uso del input file HTML directamente.
   - Asegurar que el click del input file ocurre **directamente** en el handler del click del usuario (sin awaits previos que rompan la cadena de gesto).
   - Mover la llamada nativa y el fallback a una estructura donde el gesto del usuario se preserve.

### Parte 2: Mejoras para la APK del chofer

**Archivos afectados:** Componentes en `src/components/mobile/`

| Mejora | Descripción | Archivo |
|--------|-------------|---------|
| **Avatar con cámara nativa** | Permitir que el chofer se tome una selfie para su avatar usando la cámara nativa | `MobileProfileTab.tsx` |
| **Navegación GPS nativa** | Botón "Navegar" que abre Google Maps/Waze directamente con la dirección de la próxima parada | `MobileHomeTab.tsx` |
| **Pull-to-refresh** | Gesto de arrastrar hacia abajo para refrescar datos en todas las pestañas | `MobileAppLayout.tsx` |
| **Modo offline básico** | Indicador visual claro cuando no hay conexión + cola de acciones pendientes | `MobileAppLayout.tsx` |
| **Resumen del día mejorado** | Tarjeta de resumen en Home con entregas completadas vs pendientes, km recorridos hoy, y comisiones del día | `MobileHomeTab.tsx` |
| **Vibración y sonido en scan** | Feedback háptico más claro al escanear exitosamente un QR | Ya existe parcialmente en `MobileScanTab.tsx` |
| **Tema oscuro forzado** | La APK siempre usa tema oscuro (ya lo hace) pero agregar opción de cambiar a claro desde perfil | `MobileProfileTab.tsx` |

### Detalle técnico del fix de cámara

```text
Flujo actual (roto):
  Click "Tomar Foto"
    → await useNativeCamera.takePhoto()
      → await import('@capacitor/camera')  ← FALLA en WebView remoto
      → catch silencioso, retorna null
    → no hace nada (no hay fallback)

Flujo corregido:
  Click "Tomar Foto"  
    → Si isNative Y cameraAvailable:
        → Usa Capacitor Camera (ya importado al init)
    → Si no:
        → cameraInputRef.click() DIRECTO en el handler (preserva gesto)
```

Cambios clave:
- `useNativeCamera.ts`: Intentar import al montar el hook, guardar resultado en ref. Si falla, marcar `cameraAvailable = false`.
- Componentes: Si `!cameraAvailable`, ejecutar `inputRef.click()` de forma **síncrona** en el onClick, sin awaits previos.

### Resumen de archivos a modificar

1. `src/hooks/useNativeCamera.ts` - Fix import dinámico + estado de disponibilidad
2. `src/components/delivery/DeliveryConfirmation.tsx` - Fallback robusto de cámara
3. `src/components/incidents/ReportIncidentDialog.tsx` - Fallback robusto de cámara
4. `src/components/mobile/MobileProfileTab.tsx` - Avatar con cámara + tema
5. `src/components/mobile/MobileHomeTab.tsx` - Resumen del día mejorado + botón navegar
6. `src/components/mobile/MobileAppLayout.tsx` - Pull-to-refresh + offline indicator

