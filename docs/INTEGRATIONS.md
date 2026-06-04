# Integraciones y Credenciales — Guía Técnica

> Documento de onboarding para nuevos desarrolladores. Resume **dónde vive cada credencial** del sistema y **cómo se accede en runtime**.

## 1. Patrones generales

El sistema usa **dos patrones** de almacenamiento de credenciales:

| Patrón | Cuándo se usa | Dónde vive |
|---|---|---|
| **App credentials globales** | 1 sola credencial para todo el sistema (ej: el `client_id` de la app en ML) | Lovable Secrets → expuestas como `Deno.env.get(...)` en edge functions |
| **Credenciales por tenant/cliente** | N credenciales, una por cada tenant o seller | Tabla dedicada en la DB con RLS por `tenant_id` |

**Regla**: si la credencial es del sistema (Geologistick como app), va en Secrets. Si pertenece a un cliente final (tenant), va en una tabla.

---

## 2. Supabase / Lovable Cloud

Es la única credencial **publishable** que vive en el repo.

- **Archivo**: `.env`
- **Variables**:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_PROJECT_ID`
- **Cliente**: `src/integrations/supabase/client.ts` *(auto-generado, no editar)*
- **Tipos**: `src/integrations/supabase/types.ts` *(auto-generado)*

> El `service_role` key **nunca** se expone al frontend. Solo se usa dentro de edge functions vía `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`.

---

## 3. Google Maps

**No hay API key hardcodeada en el frontend.**

- **Runtime (producción)**: edge function `get-maps-config` devuelve la key del lado server.
- **Fallback dev**: `VITE_GOOGLE_MAPS_API_KEY` en `.env` local.
- **Mobile (APK)**: inicialización global vía `GoogleMapsProvider` (ver `src/components/maps/GoogleMapsProvider.tsx`).
- **Tracking público**: misma estrategia — la key se obtiene dinámicamente.

> Ver memory: `tracking-publico-api-key-dinamica`.

---

## 4. Mercado Pago

Credenciales **por tenant** (cada tenant conecta su propia cuenta de MP).

- **Tabla**: `system_integrations`
  - `tenant_id`
  - `integration_type = 'mercadopago'`
  - `config` (JSONB) → contiene `access_token`, `public_key`, `user_id`
  - `enabled`
- **UI de gestión**: Configuración → Integraciones
- **Edge function**: `supabase/functions/mercadopago-webhook/index.ts`
  - Clona el `Request` antes de leer el body, para poder verificar HMAC y luego parsear JSON.
- **Estados de pago**: ver memory `gestion-estados-pagos`.

---

## 5. Mercado Libre

Modelo **híbrido**: credenciales globales de la app + token por seller.

### Globales (Lovable Secrets)
- `ML_CLIENT_ID`
- `ML_CLIENT_SECRET`
- *(Usadas para el flow de OAuth y refresh de tokens.)*

### Por seller (tabla `ecommerce_sellers`)
- `access_token`
- `refresh_token`
- `token_expires_at`
- `user_id_ml`
- `sender_id`

### Edge functions
- `mercadolibre-oauth` — intercambio de code por tokens
- `mercadolibre-sync` — sincronización periódica de órdenes/estados
- `mercadolibre-webhook` — notificaciones en tiempo real
- Lógica anti-downgrade y cutoff de 12hs (ver memory `gestion-sincronizacion-y-estados`)

---

## 6. ARCA / AFIP (Facturación Electrónica)

Credenciales **por tenant**, incluye certificados X.509.

- **Tabla**: `arca_config` (18 columnas, 4 policies)
- **Campos clave**:
  - `cuit`
  - `certificado` (contenido del `.crt`)
  - `clave_privada` (contenido del `.key`)
  - `punto_venta`
  - `ambiente` (`homologacion` | `produccion`)
  - `token`, `sign`, `token_expires_at` *(cache WSAA por 12hs)*
- **Edge functions**:
  - `arca-wsaa` — autenticación SOAP, genera `token`/`sign` y los guarda en `arca_config`
  - `arca-facturar` — emite comprobantes vía WSFEv1
- Ver memory: `facturacion-electronica-afip-soap`.

---

## 7. Tenant Public API Keys

Para que clientes externos (ej: Horizon frontend) consulten la API pública.

- **Tabla**: `tenant_api_keys`
  - `api_key_hash` (HMAC-SHA256)
  - `api_key_prefix` (primeros caracteres en plano, para identificación visual)
  - `tenant_id`, `name`, `permissions`, `last_used_at`
- **Edge function**: `manage-api-keys` (create/revoke)
- **Validación**: función SQL `validate_api_key(p_api_key text)` → devuelve `tenant_id` si es válida
- **Header HTTP**: `x-api-key` (requerido para endpoints con PII; anónimo recibe data ofuscada)

> Ver memory: `autenticacion-y-seguridad`.

---

## 8. Lovable AI Gateway

- **Secret auto-provisto**: `LOVABLE_API_KEY` *(gestionado por la plataforma, no editar manualmente)*
- **Uso**: edge functions de IA — `analyze-driver-route`, Live Map AI, OCR, etc.
- Para rotar: usar el tool específico de Lovable, **no** `update_secret`.

---

## 9. Build Secrets (paquetes npm privados)

- **Ubicación**: Workspace Settings → Build Secrets *(NO en runtime secrets)*
- **Uso**: durante `bun install`, referenciados desde `.npmrc` con sintaxis `${SECRET_NAME}`
- Diferentes de los runtime secrets — no aparecen en `fetch_secrets`.

---

## 10. Tabla resumen

| Integración | Globales (Secrets) | Por tenant (DB) | Edge functions |
|---|---|---|---|
| Supabase | `.env` publishable + `SUPABASE_SERVICE_ROLE_KEY` | — | (todas) |
| Google Maps | `GOOGLE_MAPS_API_KEY` | — | `get-maps-config` |
| Mercado Pago | — | `system_integrations.config` | `mercadopago-webhook` |
| Mercado Libre | `ML_CLIENT_ID`, `ML_CLIENT_SECRET` | `ecommerce_sellers.access_token/refresh_token` | `mercadolibre-oauth`, `-sync`, `-webhook` |
| ARCA / AFIP | — | `arca_config` (cert + key + tokens) | `arca-wsaa`, `arca-facturar` |
| API Pública | — | `tenant_api_keys` (hash) | `manage-api-keys` |
| Lovable AI | `LOVABLE_API_KEY` | — | (varias de IA) |

---

## 11. Cómo agregar una nueva integración

Checklist para el dev:

1. **Definir el modelo**: ¿es global (1 credencial total) o por tenant (N credenciales)?
   - Global → Lovable Secrets (`secrets--add_secret`)
   - Por tenant → nueva tabla con `tenant_id` + RLS
2. **Si creás tabla nueva**:
   - `CREATE TABLE public.<name>(...)`
   - `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<name> TO authenticated;`
   - `GRANT ALL ON public.<name> TO service_role;`
   - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
   - `CREATE POLICY ...` (scope por `tenant_id` vía `get_current_tenant_id()`)
3. **Edge function**:
   - Leer secrets con `Deno.env.get("NOMBRE_SECRET")`
   - Para credenciales por tenant: query a la tabla con `service_role` client
   - CORS headers obligatorios
4. **UI de configuración**: agregar pantalla en Configuración → Integraciones
5. **Documentar acá**: actualizar este archivo con la nueva fila en la tabla resumen.

---

## 12. Qué NUNCA hacer

- ❌ Hardcodear API keys (excepto Supabase publishable) en el frontend
- ❌ Editar `src/integrations/supabase/client.ts` o `types.ts` (auto-generados)
- ❌ Crear tablas en `public` sin `GRANT` explícitos → falla en runtime aunque tengas RLS
- ❌ Guardar `service_role` key en el cliente
- ❌ Usar `update_secret` para `LOVABLE_API_KEY` (usar el rotate tool)
- ❌ Confundir Build Secrets (workspace, install-time) con Runtime Secrets (project, edge functions)
