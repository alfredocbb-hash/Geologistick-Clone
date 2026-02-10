
# Fix: Página de "Conexión Exitosa" de MercadoLibre muestra código fuente

## Problema

Cuando un seller autoriza la conexión con MercadoLibre, el navegador muestra el código HTML en vez de renderizar la página bonita de "Conexión Exitosa". Esto pasa porque la Edge Function devuelve HTML directamente, pero el navegador no lo interpreta correctamente.

## Solución

Aplicar la misma estrategia que ya funciona para Tiendanube: en vez de devolver HTML desde la Edge Function, hacer una redirección 302 a una página del frontend React que se renderiza correctamente.

## Cambios

### 1. Nueva página: `src/pages/MercadoLibreOAuthResult.tsx`

Página React (similar a `TiendanubeOAuthResult.tsx`) que:
- Lee los query params `status`, `seller_id`, `title`, `message`
- Si `status=success`: muestra la tarjeta con gradiente amarillo MercadoLibre, logo, check animado, y mensaje de éxito
- Si `status=error`: muestra tarjeta de error con el mensaje recibido
- Envía `postMessage` al opener y se cierra automáticamente en 4 segundos

### 2. Ruta pública en `src/App.tsx`

Agregar:
```
/oauth/mercadolibre/result → MercadoLibreOAuthResult
```

### 3. Edge Function `supabase/functions/mercadolibre-oauth/index.ts`

Reemplazar todas las llamadas a `generateHtmlResponse()` por redirecciones 302 al frontend:
- Éxito: redirige a `/oauth/mercadolibre/result?status=success&seller_id=...`
- Error: redirige a `/oauth/mercadolibre/result?status=error&title=...&message=...`

Agregar funciones helper `redirectSuccess()` y `redirectError()` (mismo patrón de Tiendanube) y eliminar la función `generateHtmlResponse()` completa.

La URL base del frontend será `https://geologic.lovable.app`.
