

# Plan: Corregir el Parsing de Rutas en tiendanube-oauth

## Diagnóstico del Problema

El error 404 ocurre porque la Edge Function `tiendanube-oauth` tiene un bug en cómo parsea el path de la URL.

### Código Problemático (Línea 18)

```javascript
const path = url.pathname.replace("/tiendanube-oauth", "");
```

### Por Qué Falla

| URL que llega | Path después de replace | Esperado |
|---------------|------------------------|----------|
| `/functions/v1/tiendanube-oauth/authorize` | `/functions/v1/authorize` | `/authorize` |
| `/tiendanube-oauth/authorize` | `/authorize` | `/authorize` |

El replace solo quita la primera ocurrencia de `/tiendanube-oauth`, pero si la URL incluye el prefijo `/functions/v1/`, el resultado no es el esperado.

## Solución

Cambiar el método de extracción del path para que sea más robusto, buscando `/authorize` o `/callback` en cualquier parte del pathname.

### Código Corregido

```typescript
const url = new URL(req.url);
// Extraer el sub-path de forma más robusta
const pathname = url.pathname;
let path = "";
if (pathname.endsWith("/authorize")) {
  path = "/authorize";
} else if (pathname.endsWith("/callback")) {
  path = "/callback";
} else if (pathname.endsWith("/tiendanube-oauth") || pathname.endsWith("/tiendanube-oauth/")) {
  path = "";
}
```

Esto funciona independientemente del prefijo de la URL (`/functions/v1/`, etc.).

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/tiendanube-oauth/index.ts` | Corregir parsing del path en líneas 17-18 |

## Cambios Detallados

1. **Líneas 17-18**: Reemplazar el método de parsing actual con uno basado en `endsWith()`
2. **Agregar logging** del path recibido para debug futuro

## Verificación Post-Implementación

1. El link enviado por WhatsApp: `https://uhlgimnmfifmrxraorrl.supabase.co/functions/v1/tiendanube-oauth/authorize?seller_id=...` debería redirigir correctamente a Tiendanube
2. El callback de Tiendanube debería procesar correctamente y mostrar la página de éxito

## Beneficio Adicional

También mejoraré los mensajes de error para que si algo falla, el seller vea una página HTML amigable en lugar de JSON crudo.

