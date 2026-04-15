

## Plan: Mostrar logo del tenant en página OAuth de MercadoLibre

### Problema

La página `/oauth/mercadolibre/result` consulta `tenant_branding` para mostrar el logo del tenant, pero la tabla tiene RLS que requiere autenticación (`current_user_tenant()`). Como el usuario llega sin sesión (es un redirect de MercadoLibre), la consulta no devuelve datos y el logo no aparece.

### Solución

Pasar los datos de branding directamente como query params desde la edge function, evitando la consulta desde el frontend.

**Archivo 1: `supabase/functions/mercadolibre-oauth/index.ts`**

En el callback de éxito (~línea 208-210), antes de hacer `redirectSuccess`, consultar `tenant_branding` para obtener `logo_light`, `logo_dark`, `nombre_app` y `color_primario`, y pasarlos como query params en la URL de redirección.

```typescript
// Fetch branding for the redirect URL
const { data: brandingData } = await supabase
  .from('tenant_branding')
  .select('nombre_app, logo_light, logo_dark, color_primario')
  .eq('tenant_id', seller.tenant_id)
  .maybeSingle();

return redirectSuccess(sellerId, seller.tenant_id, brandingData);
```

Actualizar `redirectSuccess` para incluir los datos de branding en la URL:
```typescript
function redirectSuccess(sellerId: string, tenantId?: string, branding?: any) {
  let url = `${FRONTEND_URL}/oauth/mercadolibre/result?status=success&seller_id=${encodeURIComponent(sellerId)}`;
  if (tenantId) url += `&tenant_id=${encodeURIComponent(tenantId)}`;
  if (branding?.logo_light) url += `&logo=${encodeURIComponent(branding.logo_light)}`;
  if (branding?.nombre_app) url += `&app_name=${encodeURIComponent(branding.nombre_app)}`;
  if (branding?.color_primario) url += `&color=${encodeURIComponent(branding.color_primario)}`;
  return Response.redirect(url, 302);
}
```

**Archivo 2: `src/pages/MercadoLibreOAuthResult.tsx`**

Leer los datos de branding desde los query params en lugar de consultar la base de datos:

```typescript
const logo = searchParams.get("logo");
const appName = searchParams.get("app_name") || "Sistema de Envíos";
const primaryColor = searchParams.get("color") || "#FFE600";
```

Eliminar el `useEffect` que consulta `tenant_branding` y el estado `branding`.

### Archivos a modificar
1. `supabase/functions/mercadolibre-oauth/index.ts` — Pasar branding en query params
2. `src/pages/MercadoLibreOAuthResult.tsx` — Leer branding de query params

