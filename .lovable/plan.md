

# Diagnóstico y corrección: Pantalla "Error al cargar la página" persistente

## Problema identificado

La captura muestra exactamente el fallback del `ChunkErrorBoundary` — el texto "Error al cargar la página" con el botón "Recargar página". Esto significa que:

1. El boundary capturó un error
2. Intentó recargar una vez (sessionStorage flag)
3. La recarga no resolvió el problema (CDN sigue sirviendo assets viejos)
4. El usuario queda atrapado en la pantalla de error

**Hay 3 problemas en la implementación actual:**

1. **`getDerivedStateFromError` captura TODOS los errores** (no solo chunk errors), pero el fallback UI solo tiene sentido para chunk errors. Cualquier error de runtime en un componente hijo muestra esta pantalla.

2. **`"Failed to fetch"` es demasiado amplio** — captura errores de red de Supabase, Google Maps, etc. que no son chunk errors. Un query fallido de Supabase puede mostrar "Error al cargar la página".

3. **El botón "Recargar página" hace `window.location.reload()`** que puede seguir sirviendo desde cache. Debería forzar una recarga limpia con cache-busting.

## Plan de corrección

### 1. Mejorar `ChunkErrorBoundary` (src/components/ChunkErrorBoundary.tsx)

- Diferenciar entre chunk errors reales vs errores de runtime genéricos
- Para chunk errors: intentar recarga con cache-busting (`?_cb=timestamp`) en vez de `reload()` simple
- Para errores genéricos: mostrar un UI de recuperación que permita reintentar sin recargar toda la página (botón "Reintentar" que resetea el error boundary state)
- Limpiar el flag de sessionStorage con un timeout de 30 segundos para permitir reintentos

### 2. Mejorar `main.tsx` bootstrap

- Usar `fetch` con `cache: 'reload'` para verificar si `index.html` cambió antes de recargar
- Si la recarga ya se intentó, hacer hard-reload con query param para bypass de CDN

### 3. No tocar App.tsx — la estructura está bien

**Archivos a modificar:** `src/components/ChunkErrorBoundary.tsx`, `src/main.tsx` (2 archivos)

