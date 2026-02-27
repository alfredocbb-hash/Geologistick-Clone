

# Panel de Gestion de Suscripciones para Super Admin

## Resumen

Crear un panel completo en `/subscription` que, cuando lo visita el super admin, muestre todas las empresas con sus suscripciones, pagos acreditados/pendientes, y permita asignar planes manualmente (incluyendo pagos en efectivo) y enviar notificaciones.

## Cambios en base de datos

### Nueva tabla `subscription_payments`

Para registrar cada pago de suscripcion (ya sea automatico por MP o manual en efectivo/transferencia):

```text
subscription_payments
  id             uuid PK
  tenant_id      uuid FK -> tenants
  plan_id        uuid FK -> subscription_plans  
  amount         numeric NOT NULL
  payment_method text NOT NULL (mercadopago, efectivo, transferencia)
  status         text DEFAULT 'paid' (paid, pending, failed)
  reference      text (numero de recibo, ID de MP, etc)
  period_start   timestamptz
  period_end     timestamptz
  notes          text
  created_by     uuid (super admin que registro)
  created_at     timestamptz DEFAULT now()
```

Con RLS: solo super_admin puede leer/escribir.

## Cambios en frontend

### 1. Modificar `src/pages/Subscription.tsx`

Detectar si el usuario es super admin con `useAuth().isSuperAdmin()`. Si lo es, renderizar `SuperAdminSubscriptionManager` en lugar de la vista de planes para suscribirse.

### 2. Crear `src/components/subscriptions/SuperAdminSubscriptionManager.tsx`

Componente principal con 2 tabs:

**Tab "Empresas y Planes":**
- Stats cards: Total empresas, Con suscripcion activa, Sin plan, Pagos pendientes
- Tabla de empresas con columnas:
  - Nombre empresa
  - Plan actual (badge) o "Sin plan"
  - Estado suscripcion (activo/pendiente/cancelado/trial)
  - Ultimo pago (fecha + metodo)
  - Proximo vencimiento
  - Acciones: Asignar plan, Registrar pago, Notificar
- Dialog "Asignar/Cambiar Plan": selector de plan, upsert en `tenant_subscriptions`
- Dialog "Enviar Notificacion": titulo, mensaje, tipo -> inserta en `notifications` para todos los admins del tenant

**Tab "Pagos":**
- Filtros: empresa, estado (acreditado/pendiente), metodo de pago, rango de fechas
- Tabla de pagos con columnas:
  - Empresa
  - Plan
  - Monto
  - Metodo (MP / Efectivo / Transferencia)
  - Estado (badge verde "Acreditado" / amarillo "Pendiente")
  - Periodo cubierto
  - Referencia
  - Fecha
- Dialog "Registrar Pago Manual": seleccionar empresa, plan, monto (precargado del plan), metodo de pago (efectivo/transferencia/otro), referencia, periodo, notas
- Boton para marcar pagos pendientes como acreditados

### 3. Flujo de asignacion + pago manual

1. Super admin selecciona empresa -> "Asignar Plan"
2. Elige plan -> se hace upsert en `tenant_subscriptions` con status "active"
3. Opcionalmente registra el pago: inserta en `subscription_payments` con metodo "efectivo" o "transferencia"
4. El tenant queda con su plan activo inmediatamente

### 4. Flujo de notificacion

Se buscan usuarios con rol `admin` del tenant seleccionado via `user_roles` + `profiles`, y se inserta una notificacion para cada uno.

## Detalle tecnico

| Archivo | Cambio |
|---|---|
| Migracion SQL | Crear tabla `subscription_payments` con RLS para super_admin |
| `src/pages/Subscription.tsx` | Agregar deteccion de super admin, renderizar componente diferente |
| `src/components/subscriptions/SuperAdminSubscriptionManager.tsx` | Nuevo: tabla de empresas + tabs + dialogs de asignar plan, registrar pago, notificar |

### Queries principales

1. Tenants con suscripcion: `tenants` LEFT JOIN `tenant_subscriptions` + `subscription_plans`
2. Pagos: `subscription_payments` JOIN `tenants` + `subscription_plans`
3. Planes disponibles: `subscription_plans` WHERE `is_active = true`
4. Admins del tenant: `profiles` JOIN `user_roles` WHERE `role = 'admin'` AND `tenant_id = X`
5. Registrar pago: INSERT en `subscription_payments`
6. Asignar plan: UPSERT en `tenant_subscriptions`

### Estructura de la tabla principal

```text
| Empresa    | Plan          | Estado  | Ultimo Pago        | Vencimiento | Acciones               |
|------------|---------------|---------|--------------------|-------------|------------------------|
| BlackBox   | Profesional   | Activo  | 01/02 - Efectivo   | 01/03       | [Plan] [Pago] [Notif]  |
| MiEmpresa  | Sin plan      | -       | -                  | -           | [Plan] [Pago] [Notif]  |
| LogiCorp   | Basico        | Activo  | 15/02 - MP         | 15/03       | [Plan] [Pago] [Notif]  |
```

### Estructura de la tabla de pagos

```text
| Empresa    | Plan        | Monto     | Metodo        | Estado     | Periodo        | Ref     |
|------------|-------------|-----------|---------------|------------|----------------|---------|
| BlackBox   | Profesional | $15.000   | Efectivo      | Acreditado | 01/02 - 01/03  | REC-001 |
| LogiCorp   | Basico      | $8.000    | Mercado Pago  | Acreditado | 15/02 - 15/03  | MP-XXX  |
| OtraEmp    | Profesional | $15.000   | Transferencia | Pendiente  | 01/03 - 01/04  | -       |
```
