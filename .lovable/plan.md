

# Plan: Corrección de Páginas Públicas de Tracking

## Problema Identificado

Las páginas públicas de tracking (`/tracking` y `/tracking-embed`) no funcionan para clientes externos debido a dos problemas:

1. **Edge Function no desplegada**: La función `public-tracking` devuelve error 404 cuando se intenta acceder
2. **TrackingEmbed usa acceso directo a BD**: Consulta directamente la tabla `envios` sin autenticación, lo cual es bloqueado por RLS

---

## Solución

### Parte 1: Forzar redespliegue de Edge Function

Modificar ligeramente el archivo de la función para forzar un redespliegue completo.

### Parte 2: Corregir TrackingEmbed para usar la Edge Function

Actualizar `TrackingEmbed.tsx` para usar la Edge Function `public-tracking` en lugar de consultar directamente la base de datos, igual que hace `Tracking.tsx`.

---

## Cambios Requeridos

### Archivo 1: `supabase/functions/public-tracking/index.ts`

Agregar un comentario o timestamp para forzar el redespliegue:

```typescript
// Force redeploy: 2026-01-23
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// ... resto del código
```

### Archivo 2: `src/pages/TrackingEmbed.tsx`

Reemplazar las consultas directas a Supabase por llamadas a la Edge Function:

**Antes (problemático):**
```typescript
const { data: envio } = useQuery({
  queryFn: async () => {
    let query = supabase.from("envios").select(...)  // Bloqueado por RLS
  }
});
```

**Después (correcto):**
```typescript
const { data: envio } = useQuery({
  queryFn: async () => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-tracking?code=${searchedTracking}`
    );
    const data = await response.json();
    if (!response.ok || data.error) return null;
    return data;
  }
});
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/public-tracking/index.ts` | Agregar comentario para forzar redespliegue |
| `src/pages/TrackingEmbed.tsx` | Usar Edge Function en lugar de acceso directo a BD |

---

## Flujo Corregido

```text
Cliente externo busca tracking
         │
         ▼
┌─────────────────────────────────────────────┐
│  /tracking o /tracking-embed                │
│  (páginas públicas sin autenticación)       │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Edge Function: public-tracking             │
│  (usa SERVICE_ROLE_KEY para bypass RLS)     │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Devuelve datos del envío + branding        │
│  (JSON público sin datos sensibles)         │
└─────────────────────────────────────────────┘
```

---

## Beneficios

1. **Ambas páginas funcionarán** para clientes externos sin autenticación
2. **Seguridad mantenida**: Solo se exponen datos de tracking públicos
3. **Branding dinámico**: Cada empresa verá su logo y colores
4. **Código unificado**: Ambas páginas usan la misma fuente de datos

---

## Orden de Implementación

1. Modificar y redesplegar la Edge Function `public-tracking`
2. Actualizar `TrackingEmbed.tsx` para usar la Edge Function
3. Verificar que ambas páginas funcionen correctamente

