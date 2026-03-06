

# Sistema de envío de emails SMTP por tenant

## Situación actual
Beraexpress configuró sus datos SMTP en el sistema (host: c2320253.ferozo.com, puerto 465, usuario: clientes@beraexpress.com). Sin embargo, **no existe ninguna edge function que use esa configuración para enviar emails**. Los datos se guardan pero no se usan.

Además hay un problema en los datos: el campo `from_email` dice "Notificacion@beraexpress" (sin dominio completo).

## Plan

### 1. Edge function `send-tenant-email`
Crear una función backend que:
- Reciba: `tenant_id`, `to` (destinatario), `subject`, `template` (tipo de email), `data` (variables del template)
- Lea la config SMTP del tenant desde `system_integrations`
- Envíe el email usando SMTP (librería `nodemailer` vía npm specifier en Deno)
- Soporte SSL/TLS (puerto 465) y STARTTLS (puerto 587)
- Incluya un modo `test` para enviar un email de prueba

### 2. Templates de email HTML
Crear templates inline en la función para:
- **Notificación de estado**: cuando un envío cambia de estado (en reparto, entregado, devuelto, etc.)
- **Confirmación de creación**: cuando se crea un envío nuevo
- Los templates usan el branding del tenant (nombre, logo) obtenido de `tenant_branding`

### 3. Trigger automático de emails
Modificar el trigger `log_envio_estado_change` o crear uno nuevo que invoque la edge function cuando cambia el estado de un envío, enviando notificación al destinatario si tiene email configurado.

Alternativa más simple y confiable: invocar el envío de email desde el frontend cuando se realizan acciones clave (cambio de estado, creación de envío), ya que los triggers HTTP desde la DB pueden fallar silenciosamente.

### 4. Botón "Enviar email de prueba" en IntegrationSettings
Agregar un botón en la sección Email SMTP de la configuración de integraciones que envíe un email de prueba al usuario logueado para verificar que la config funciona.

### 5. Corregir datos de Beraexpress
Corregir `from_email` de "Notificacion@beraexpress" a "Notificacion@beraexpress.com" (o el dominio correcto) y mover de entorno `sandbox` a `production`.

## Archivos a crear/modificar
- `supabase/functions/send-tenant-email/index.ts` (nuevo) - Edge function SMTP
- `supabase/config.toml` - Agregar verify_jwt = false para la nueva función
- `src/pages/IntegrationSettings.tsx` - Botón "Enviar email de prueba"
- Evaluar integración en flujos de cambio de estado (desde frontend)

## Orden de implementación
1. Crear la edge function con soporte SMTP + templates
2. Agregar botón de prueba en la UI
3. Probar con la config de Beraexpress
4. Integrar envío automático en cambios de estado

