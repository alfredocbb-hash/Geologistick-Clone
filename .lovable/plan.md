

# Plan de Mejora de Seguridad

## Resumen Ejecutivo

Después de un análisis exhaustivo de la aplicación, he identificado varios problemas de seguridad que requieren atención. Este plan prioriza las correcciones por nivel de riesgo.

---

## Hallazgos y Correcciones

### 1. BUG CRITICO: Inconsistencia en `integration_type` de MercadoLibre

**Problema Detectado:**
- La UI en `IntegrationSettings.tsx` usa `'mercadolibre'` como tipo
- Las Edge Functions buscan `'mercado_libre'` (con guión bajo)
- El enum de la base de datos NO incluye ninguno de estos valores

**Riesgo:** Las credenciales de MercadoLibre NO se pueden guardar ni recuperar correctamente.

**Corrección:**
1. Agregar `'mercadolibre'` al enum `integration_type` en la base de datos
2. Actualizar las Edge Functions para usar `'mercadolibre'` (consistente con la UI)

### 2. ALTA: Habilitar Leaked Password Protection

**Problema:** La protección contra contraseñas filtradas está desactivada.

**Riesgo:** Los usuarios pueden registrarse con contraseñas comprometidas en brechas de datos conocidas.

**Corrección:** Habilitar en la configuración de autenticación (se configura vía herramienta de Cloud).

### 3. MEDIA: Tabla `ml_status_mapping` Públicamente Accesible

**Problema:** La política `'Anyone can view ML status mapping'` permite que cualquiera (incluso usuarios anónimos) vea el mapeo de estados.

**Riesgo:** Exposición de lógica de negocio interna a competidores.

**Corrección:**
```sql
-- Eliminar política pública
DROP POLICY IF EXISTS "Anyone can view ML status mapping" ON ml_status_mapping;

-- Crear política para usuarios autenticados del mismo tenant
CREATE POLICY "Authenticated users can view ML status mapping"
ON ml_status_mapping FOR SELECT
TO authenticated
USING (true);
```

### 4. MEDIA: Tabla `subscription_plans` Expuesta a Usuarios Autenticados

**Problema:** Cualquier usuario autenticado puede ver todos los planes de suscripción con precios y configuración de Stripe.

**Riesgo:** Competidores pueden crear cuentas para extraer información de pricing.

**Corrección:**
```sql
-- Restringir a solo super_admins y usuarios que necesitan ver planes durante checkout
DROP POLICY IF EXISTS "Ver planes activos" ON subscription_plans;

CREATE POLICY "Ver planes activos para checkout"
ON subscription_plans FOR SELECT
USING (
  is_active = true 
  AND (
    is_super_admin(auth.uid()) 
    OR current_user_is_admin()
    -- O durante el flujo de checkout (verificar sesión)
  )
);
```

### 5. BAJA: Tabla `landing_content` Expuesta

**Problema:** Contenido de landing page es público (necesario para la página de inicio).

**Riesgo:** Exposición de estrategia de marketing y emails de contacto.

**Nota:** Este es un riesgo aceptable ya que el contenido debe ser público para la landing page. Sin embargo, se puede limitar qué campos se exponen.

### 6. MEJORA: Webhook de MercadoLibre sin Validación de Firma

**Problema:** El webhook acepta cualquier POST sin verificar que realmente provenga de MercadoLibre.

**Riesgo:** Un atacante podría enviar webhooks falsos para crear envíos fraudulentos.

**Corrección Recomendada:**
- Verificar el `user_id` contra sellers registrados (ya implementado)
- Agregar validación de IP de origen (IPs de ML)
- O implementar verificación de firma si ML lo soporta

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| Nueva migración SQL | Agregar `mercadolibre` al enum y ajustar RLS |
| `supabase/functions/mercadolibre-oauth/index.ts` | Cambiar `mercado_libre` → `mercadolibre` |
| `supabase/functions/mercadolibre-webhook/index.ts` | Cambiar `mercado_libre` → `mercadolibre` |
| `supabase/functions/mercadolibre-update-status/index.ts` | Cambiar `mercado_libre` → `mercadolibre` |

---

## Detalle Técnico de la Migración SQL

```sql
-- 1. Agregar valor al enum
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'mercadolibre';

-- 2. Corregir política de ml_status_mapping
DROP POLICY IF EXISTS "Anyone can view ML status mapping" ON ml_status_mapping;

CREATE POLICY "Authenticated users can view ML status mapping"
ON ml_status_mapping FOR SELECT
TO authenticated
USING (true);

-- 3. Denegar acceso anónimo explícitamente
CREATE POLICY "Deny anonymous access to ML status mapping"
ON ml_status_mapping FOR SELECT
TO anon
USING (false);
```

---

## Resumen de Prioridades

| Prioridad | Issue | Esfuerzo |
|-----------|-------|----------|
| CRITICO | Bug de `integration_type` inconsistente | Bajo |
| ALTA | Leaked Password Protection | Configuración |
| MEDIA | RLS de `ml_status_mapping` | Bajo |
| MEDIA | RLS de `subscription_plans` | Bajo |
| BAJA | Webhook sin firma | Medio |

---

## Nota sobre Secrets en Plaintext

El escaneo de seguridad anterior indicó que las credenciales de terceros se almacenan en texto plano en `system_integrations`. Esto es un riesgo conocido pero de difícil remediación (requiere Supabase Vault y refactorización extensa). Se recomienda como mejora futura pero NO es bloqueante para la operación actual.

