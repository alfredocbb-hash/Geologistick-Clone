

# Bloqueo total cuando vence la suscripción o el trial

## Situación actual
- Cuando un trial/suscripción vence, solo se muestra un banner informativo
- El usuario puede seguir operando sin restricciones

## Diseño

Crear un componente `SubscriptionBlockScreen` que se renderice en `DashboardLayout` y `SellerLayout` cuando se detecte que la suscripción/trial venció, bloqueando completamente el acceso al sistema.

**Lógica de bloqueo:**
1. Trial expirado (`plan === 'trial'` y `trial_ends_at <= now`) → bloqueado
2. Suscripción vencida (`tenant_subscriptions.status !== 'active'` o `current_period_end < now`) → bloqueado
3. Super admins → nunca bloqueados
4. Sin datos de suscripción aún cargando → no bloquear (evitar falsos positivos)

## Cambios

### 1. Nuevo hook: `src/hooks/useSubscriptionBlock.ts`
Hook liviano que consulta `tenants` + `tenant_subscriptions` para determinar si el tenant está bloqueado. Retorna `{ isBlocked, isLoading, reason }`.

- Si `plan === 'trial'` y `trial_ends_at <= now` → bloqueado, reason: "trial_expired"
- Si tiene `tenant_subscriptions` con `status !== 'active'` o `current_period_end < now` → bloqueado, reason: "subscription_expired"
- Si `plan !== 'trial'` y no tiene `tenant_subscriptions` → no bloqueado (tenant sin plan configurado, se permite acceso)

### 2. Nuevo componente: `src/components/subscription/SubscriptionBlockScreen.tsx`
Pantalla fullscreen con:
- Icono y mensaje claro: "Tu suscripción ha vencido"
- Texto: "Para continuar usando el sistema, contactá al equipo de soporte"
- Botón "Contactar Soporte" → link a `/support` (o mailto si está bloqueado del dashboard)
- Botón "Cerrar sesión"
- Sin sidebar, sin header, sin acceso a nada

### 3. Modificar `src/components/layout/DashboardLayout.tsx`
- Importar `useSubscriptionBlock` y `useAuth`
- Después de verificar autenticación, si `isBlocked && !isSuperAdmin()` → renderizar `<SubscriptionBlockScreen reason={reason} />`

### 4. Modificar `src/components/seller/SellerLayout.tsx`
- Misma lógica: si `isBlocked` → mostrar `<SubscriptionBlockScreen />`

### 5. Modificar `src/components/mobile/MobileAppLayout.tsx`
- Misma lógica para la app móvil

**4 archivos nuevos/modificados. Super admins nunca son bloqueados.**

