

# Plan: Mostrar Logo del Tenant en Tracking Público

## Objetivo

Cuando un cliente rastrea su envío, mostrar el logo de la empresa (tenant) correspondiente en lugar del logo genérico.

---

## Situación Actual

| Página | URL | Logo | Estado |
|--------|-----|------|--------|
| Tracking público | `/tracking` | Icono genérico | ❌ Sin branding |
| Tracking embed | `/tracking-embed?tenant_slug=X` | ✅ Logo del tenant | Funciona con parámetro |

El problema es que en `/tracking` no sabemos el tenant hasta **después** de buscar el envío.

---

## Solución Propuesta

### 1. Modificar Edge Function `public-tracking`

Incluir información del branding del tenant en la respuesta:

```typescript
// Agregar al query del envío
const { data: envio } = await query.single();

// Obtener branding del tenant
const { data: branding } = await supabaseClient
  .from("tenant_branding")
  .select("nombre_app, logo_light, logo_dark, color_primario")
  .eq("tenant_id", envio.tenant_id)
  .single();

// Incluir en respuesta
const response = {
  ...existingFields,
  branding: branding ? {
    nombre_app: branding.nombre_app,
    logo: branding.logo_light || branding.logo_dark,
    color_primario: branding.color_primario,
  } : null,
};
```

### 2. Modificar `src/pages/Tracking.tsx`

Usar la Edge Function en lugar de consulta directa:

```typescript
// Cambiar queryFn para usar Edge Function
const { data: envio, isLoading } = useQuery({
  queryKey: ['tracking', searchedTracking],
  queryFn: async () => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-tracking?code=${searchedTracking}`
    );
    if (!response.ok) return null;
    return response.json();
  },
  enabled: !!searchedTracking,
});

// Mostrar logo dinámicamente
{envio?.branding?.logo && (
  <img 
    src={envio.branding.logo} 
    alt={envio.branding.nombre_app}
    className="h-16 mx-auto object-contain"
  />
)}
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/public-tracking/index.ts` | Incluir branding del tenant en respuesta |
| `src/pages/Tracking.tsx` | Usar Edge Function y mostrar logo dinámico |

---

## Flujo Visual

```text
ANTES:                                    DESPUÉS:
┌─────────────────────────────┐          ┌─────────────────────────────┐
│      📍 Icono genérico      │          │     [LOGO EMPRESA]          │
│                             │          │     Nombre de la App        │
│   "Rastrea tu Envío"        │          │                             │
│                             │          │   "Rastrea tu Envío"        │
│   [___________________]     │          │                             │
│                             │          │   [___________________]     │
│   Tracking: XXX-123         │          │                             │
│   Estado: En Tránsito       │          │   Tracking: XXX-123         │
│                             │          │   Estado: En Tránsito       │
└─────────────────────────────┘          └─────────────────────────────┘

     Sin personalización                      Branding del tenant
```

---

## Detalles de Implementación

### Edge Function - Campos a agregar:

```json
{
  "tracking_number": "SUC01-ENV-20260122-C86B88",
  "estado": "en_transito",
  "branding": {
    "nombre_app": "TransExpress",
    "logo": "https://storage.../logo.png",
    "color_primario": "#2563eb"
  },
  "origen": { ... },
  "destino": { ... },
  "historial": [ ... ]
}
```

### Tracking.tsx - Header dinámico:

- Si hay logo → mostrar imagen centrada
- Si hay `nombre_app` → mostrar como título
- Si hay `color_primario` → aplicar al botón de búsqueda
- Fallback al diseño actual si no hay branding

---

## Beneficios

1. **White-label completo**: Cada empresa ve su propia marca
2. **Sin configuración manual**: Se detecta automáticamente del envío
3. **Consistencia**: Mismo branding que en otras partes del sistema
4. **Seguridad**: La Edge Function bypasea RLS de forma segura

