

# Plan: Corregir Edge Function de MercadoLibre OAuth para Envíos Flex

## Contexto

Esta integración es para los **envíos Flex de MercadoLibre** que permiten a Beraexpress recibir automáticamente los pedidos con logística "self_service" para su gestión.

## Problema Actual

Las credenciales de Beraexpress están correctamente guardadas:

| config_key | config_value |
|------------|--------------|
| client_id | 221043070220552 |
| client_secret | VIpsj0IRyox... |

Pero la Edge Function `mercadolibre-oauth` tiene dos errores:

| Error | Código Actual | Debería Ser |
|-------|---------------|-------------|
| Columna inexistente | `.select('config')` | `.select('config_key, config_value')` |
| Enum incorrecto | `'mercado_libre'` | `'mercadolibre'` |

## Solución

Modificar la Edge Function para usar el esquema key-value de `system_integrations`.

### Cambios en `supabase/functions/mercadolibre-oauth/index.ts`

**1. Agregar función helper para obtener configuración:**

```typescript
// Helper to get integration config as object from key-value rows
async function getIntegrationConfig(
  supabase: any,
  tenantId: string
): Promise<Record<string, string> | null> {
  const { data, error } = await supabase
    .from('system_integrations')
    .select('config_key, config_value')
    .eq('tenant_id', tenantId)
    .eq('integration_type', 'mercadolibre')  // Enum correcto
    .eq('is_active', true);

  if (error || !data || data.length === 0) {
    return null;
  }

  // Convertir filas key-value a objeto
  const config: Record<string, string> = {};
  for (const row of data) {
    config[row.config_key] = row.config_value;
  }
  return config;
}
```

**2. Actualizar AUTHORIZE endpoint (líneas 56-72):**

```typescript
// Antes:
const { data: integration } = await supabase
  .from('system_integrations')
  .select('config')
  .eq('integration_type', 'mercado_libre')
  .single();

// Después:
const config = await getIntegrationConfig(supabase, seller.tenant_id);
if (!config || !config.client_id) {
  return new Response(
    JSON.stringify({ error: 'MercadoLibre integration not configured' }),
    { status: 400, headers: corsHeaders }
  );
}
```

**3. Actualizar CALLBACK endpoint (líneas 136-154):**

Mismo cambio: reemplazar query por `getIntegrationConfig()`

**4. Actualizar REFRESH endpoint (líneas 256-271):**

Mismo cambio: reemplazar query por `getIntegrationConfig()`

---

## Archivo a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/mercadolibre-oauth/index.ts` | Usar esquema key-value y enum 'mercadolibre' |

---

## Resultado Esperado

Después del cambio, el flujo será:

```text
Admin envía link por WhatsApp
         │
         ▼
Cliente hace clic en el link
         │
         ▼
Edge Function obtiene credenciales correctamente
         │
         ▼
Redirige a MercadoLibre para autorización
         │
         ▼
Cliente autoriza → tokens guardados → ¡Conectado!
         │
         ▼
Webhook recibe pedidos Flex automáticamente
```

