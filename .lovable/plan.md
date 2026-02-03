

# Plan: Correccion de Eliminacion de Empresas, Restriccion de Registro y Migracion a Mercado Pago

## Resumen de Cambios

Este plan aborda las 3 solicitudes:
1. Corregir el error de foreign key al eliminar empresas
2. Eliminar registro publico y reemplazarlo por solicitud de prueba
3. Migrar las suscripciones de Stripe a Mercado Pago

---

## 1. Correccion del Error al Eliminar Empresas

### Problema
El `DeleteTenantDialog.tsx` no elimina todas las tablas relacionadas con el tenant antes de intentar eliminar el registro principal. Faltan al menos 15 tablas con `tenant_id`.

### Solucion
Actualizar `DeleteTenantDialog.tsx` agregando la eliminacion en cascada de las siguientes tablas faltantes:

| Tabla | Dependencias |
|-------|-------------|
| `seller_cuenta_corriente` | Via ecommerce_sellers |
| `liquidaciones_seller` | Via ecommerce_sellers |
| `ecommerce_orders` | Directa |
| `ecommerce_sellers` | Directa |
| `system_integrations` | Directa |
| `tenant_api_keys` | Directa |
| `tenant_subscriptions` | Directa |
| `tenant_usage` | Directa |
| `vehiculos` | Directa |
| `empresas_terciarizadas` | Directa |
| `rutas_frecuentes` | Via ruta_frecuente_paradas |
| `configuracion_seguro` | Directa |
| `tarifa_concepto_precios` | Via tarifa_conceptos |
| `tarifa_conceptos` | Via tarifas |
| `historial_ajustes_tarifas` | Directa |
| `sucursal_tarifas` | Via sucursales |
| `sucursal_conceptos` | Via sucursales |
| `tarifas` | Directa |
| `driver_location_history` | Via profiles/user_id |

### Orden de eliminacion
Se respetara el orden correcto de foreign keys para evitar errores.

---

## 2. Eliminacion del Registro Publico

### Cambios en la Pagina de Login

Modificar `src/components/auth/LoginForm.tsx`:
- Eliminar la pestaña "Registrarse" completamente
- Mostrar solo el formulario de inicio de sesion
- Agregar un enlace "Solicitar Prueba" que redirija a la landing page

### Nueva Tabla de Solicitudes de Prueba

Crear tabla `trial_requests` para almacenar solicitudes:

```sql
CREATE TABLE public.trial_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_empresa VARCHAR(255) NOT NULL,
  nombre_contacto VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telefono VARCHAR(50),
  mensaje TEXT,
  estado VARCHAR(20) DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id)
);
```

### Nueva Seccion en Landing Page

Modificar `src/components/landing/Pricing.tsx`:
- Cambiar el boton "Comenzar gratis" por "Solicitar Prueba Gratuita"
- El boton abrira un modal para completar el formulario

### Nuevo Componente de Solicitud

Crear `src/components/landing/TrialRequestDialog.tsx`:
- Formulario con campos: nombre empresa, contacto, email, telefono, mensaje
- Al enviar, guarda en `trial_requests`
- Muestra mensaje de confirmacion

### Panel de Gestion para Super Admin

Crear `src/pages/TrialRequests.tsx`:
- Lista de solicitudes pendientes
- Acciones: Aprobar (crea tenant + usuario), Rechazar
- Historial de solicitudes procesadas

---

## 3. Migracion de Suscripciones de Stripe a Mercado Pago

### Cambios en Edge Functions

**Actualizar `create-checkout` a `mp-create-subscription`:**
- Usar la API de Mercado Pago Subscriptions
- Endpoint: `POST /preapproval` para suscripciones
- Retornar URL de checkout de Mercado Pago

**Actualizar `check-subscription` a usar MP:**
- Consultar suscripciones activas via API de MP
- Endpoint: `GET /preapproval/search`
- Sincronizar estado con la base de datos local

**Actualizar `customer-portal` a usar MP:**
- Mercado Pago no tiene portal de cliente como Stripe
- Crear endpoint que permita cancelar/pausar suscripcion directamente

### Cambios en la Base de Datos

Actualizar tabla `subscription_plans`:
- Agregar columna `mercadopago_plan_id` VARCHAR
- Mantener `stripe_price_id` para retrocompatibilidad

Actualizar tabla `tenant_subscriptions`:
- Agregar columna `mercadopago_subscription_id` VARCHAR
- Agregar columna `mercadopago_payer_id` VARCHAR

### Cambios en Frontend

**Actualizar `src/hooks/useSubscription.ts`:**
- Cambiar llamadas de Stripe a Mercado Pago
- Actualizar tipos para nuevos campos

**Actualizar `src/pages/Subscription.tsx`:**
- Adaptar UI para flujo de Mercado Pago
- Cambiar boton "Gestionar Suscripcion" por opciones directas (Cancelar, Ver Estado)

**Actualizar `src/components/landing/Pricing.tsx`:**
- Mantener UI pero cambiar destino del checkout

### Configuracion de Mercado Pago

Reutilizar la integracion existente en `system_integrations`:
- Tipo: `mercado_pago`
- Claves: `access_token`, `public_key`
- Ya esta multi-tenant implementado

---

## Archivos a Crear/Modificar

| Archivo | Accion |
|---------|--------|
| `src/components/tenants/DeleteTenantDialog.tsx` | MODIFICAR - Agregar tablas faltantes |
| `src/components/auth/LoginForm.tsx` | MODIFICAR - Eliminar registro, agregar link solicitar prueba |
| `src/components/landing/TrialRequestDialog.tsx` | CREAR - Formulario solicitud prueba |
| `src/components/landing/Pricing.tsx` | MODIFICAR - Cambiar CTA a solicitar prueba |
| `src/pages/TrialRequests.tsx` | CREAR - Panel gestion solicitudes |
| `src/App.tsx` | MODIFICAR - Agregar ruta /trial-requests |
| `supabase/functions/mp-create-subscription/index.ts` | CREAR - Nueva function para crear suscripcion MP |
| `supabase/functions/mp-check-subscription/index.ts` | CREAR - Nueva function para verificar suscripcion MP |
| `supabase/functions/mp-cancel-subscription/index.ts` | CREAR - Nueva function para cancelar suscripcion |
| `src/hooks/useSubscription.ts` | MODIFICAR - Adaptar para Mercado Pago |
| `src/pages/Subscription.tsx` | MODIFICAR - Adaptar UI para MP |
| **Migracion SQL** | CREAR - Tabla trial_requests y columnas MP |

---

## Flujo de Solicitud de Prueba

```text
Usuario visita Landing
        |
        v
Click "Solicitar Prueba"
        |
        v
Completa formulario
(empresa, nombre, email, tel)
        |
        v
Se guarda en trial_requests
        |
        v
Super Admin recibe notificacion
        |
        v
Revisa solicitud en /trial-requests
        |
        v
Aprueba --> Crea tenant + usuario + envia email con credenciales
   O
Rechaza --> Marca como rechazada
```

---

## Flujo de Suscripcion con Mercado Pago

```text
Usuario en /subscription
        |
        v
Click "Suscribirse" en plan
        |
        v
mp-create-subscription crea preferencia
        |
        v
Redirige a checkout.mercadopago.com
        |
        v
Usuario paga con tarjeta/debito
        |
        v
MP envia webhook a mp-webhook-subscription
        |
        v
Sistema actualiza tenant_subscriptions
        |
        v
Usuario ve su suscripcion activa
```

---

## API de Mercado Pago para Suscripciones

### Crear Suscripcion
```text
POST https://api.mercadopago.com/preapproval
{
  "reason": "LogiTrack Profesional",
  "auto_recurring": {
    "frequency": 1,
    "frequency_type": "months",
    "transaction_amount": 15000,
    "currency_id": "ARS"
  },
  "back_url": "https://app.com/subscription?status=approved",
  "payer_email": "user@email.com"
}
```

### Consultar Suscripciones
```text
GET https://api.mercadopago.com/preapproval/search?payer_email=user@email.com
```

### Cancelar Suscripcion
```text
PUT https://api.mercadopago.com/preapproval/{id}
{ "status": "cancelled" }
```

---

## Notas Importantes

1. **Retrocompatibilidad**: Se mantienen las columnas de Stripe para usuarios existentes
2. **Multi-tenant**: La configuracion de MP ya esta multi-tenant en system_integrations
3. **Seguridad**: Solo Super Admins pueden aprobar solicitudes de prueba
4. **Eliminacion de empresas**: Se usara transaccion para garantizar atomicidad

