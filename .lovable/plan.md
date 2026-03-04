

# Diagnóstico: Página en blanco en producción

## Causa raíz probable

**El `index.html` queda cacheado en el CDN o navegador tras un deploy.** Cuando se publica una nueva versión, Vite genera bundles con hashes nuevos (ej: `main-abc123.js`). Si el usuario recibe un `index.html` viejo (cacheado), este apunta a archivos JS que ya no existen en el servidor, resultando en una página en blanco. `Ctrl+Shift+R` fuerza descargar el `index.html` nuevo y se arregla temporalmente.

**Evidencia:**
- No hay service worker en el proyecto (descartado como causa)
- Las meta tags `http-equiv="Cache-Control"` en `index.html` son ignoradas por CDNs y la mayoría de navegadores modernos (solo funcionan headers HTTP reales)
- Vite ya genera hashes en los assets (`main-[hash].js`), así que el problema es exclusivamente el cacheo de `index.html`
- El dominio custom `geologistick.com` probablemente pasa por un CDN (Cloudflare u otro) que cachea todo

## Plan de corrección (3 cambios)

### 1. Agregar auto-recovery en el frontend
**Archivo: `src/main.tsx`**

Envolver el bootstrap de React en un try/catch que detecte errores de carga de módulos (chunks faltantes) y fuerce una recarga limpia automáticamente, sin intervención del usuario.

```
Si falla la carga de un chunk → limpiar cache del navegador → recargar la página una sola vez
```

Esto cubre el caso donde el usuario tiene un `index.html` viejo apuntando a chunks que ya no existen.

### 2. Agregar lazy-load error boundary en el router
**Archivo: `src/App.tsx`**

Agregar un error boundary que capture `ChunkLoadError` en rutas lazy-loaded y recargue automáticamente. Esto previene la pantalla en blanco cuando un usuario navega a una ruta cuyo chunk fue reemplazado por un deploy.

### 3. Configuración CDN (acción del usuario)
Si usa Cloudflare u otro CDN en `geologistick.com`:
- Crear Page Rule: `geologistick.com/index.html` → Cache Level: Bypass
- O configurar `Browser Cache TTL: Respect Existing Headers` + asegurarse que el origin envíe `no-cache` para HTML

**Archivos a modificar:** `src/main.tsx`, `src/App.tsx` (2 archivos)

