# Documentación de Integraciones para Devs

Crear un único archivo `docs/INTEGRATIONS.md` en AR Spanish con toda la información de dónde viven las credenciales del sistema.

## Contenido del archivo

### 1. Overview
Dos patrones de almacenamiento:
- **App credentials globales** → Lovable Secrets (env de edge functions)
- **Credenciales por tenant/cliente** → tablas dedicadas con RLS por `tenant_id`

### 2. Supabase / Lovable Cloud
- `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` (publishable, OK en repo)
- Cliente: `src/integrations/supabase/client.ts` (auto-generado, no editar)
- Tipos: `src/integrations/supabase/types.ts` (auto-generado)

### 3. Google Maps
- Sin hardcode. Edge function `get-maps-config` devuelve la key en runtime
- Fallback dev: `VITE_GOOGLE_MAPS_API_KEY`
- Mobile: inicialización global vía `GoogleMapsProvider`

### 4. Mercado Pago
- **Tabla**: `system_integrations` (config JSONB, `integration_type='mercadopago'`)
- Por tenant: `access_token`, `public_key`
- Edge function: `mercadopago-webhook` (verifica HMAC clonando request)
- UI: Configuración → Integraciones

### 5. Mercado Libre
- **Globales** (Lovable Secrets): `ML_CLIENT_ID`, `ML_CLIENT_SECRET`
- **Por seller** (tabla `ecommerce_sellers`): `access_token`, `refresh_token`, `token_expires_at`
- Edge functions: `mercadolibre-oauth`, `mercadolibre-sync`, `mercadolibre-webhook`

### 6. ARCA / AFIP
- **Tabla**: `arca_config` por tenant
- Columnas: `cuit`, `certificado` (.crt), `clave_privada` (.key), `punto_venta`, `ambiente`, `token`, `sign`, `token_expires_at` (cache 12hs)
- Edge functions: `arca-wsaa` (autenticación SOAP), `arca-facturar`

### 7. Tenant Public API Keys
- **Tabla**: `tenant_api_keys`
- Hash HMAC-SHA256 + prefijo plano para identificación
- Edge function: `manage-api-keys`
- Validación SQL: `validate_api_key(p_api_key text)`

### 8. Lovable AI Gateway
- Secret auto-provisto: `LOVABLE_API_KEY`
- Usado por edge functions de IA (live-map AI, analyze-driver-route, etc.)

### 9. Build Secrets
- Para paquetes npm privados, configurados en Workspace Settings → Build Secrets
- Referenciados en `.npmrc`

### 10. Tabla resumen
Matriz: Integración | Globales | Por tenant | Edge functions

### 11. Cómo agregar una nueva integración
Checklist:
1. ¿Es global o por tenant? → Secrets vs tabla nueva
2. Si es tabla nueva: RLS + GRANT obligatorios
3. Edge function lee secrets con `Deno.env.get()`
4. UI de configuración en Settings
5. Documentar acá

## Archivos

- **Crear**: `docs/INTEGRATIONS.md`

No se tocan archivos de código ni schema.
