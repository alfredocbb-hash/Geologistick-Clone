

# Redirigir banners de vencimiento a Soporte en lugar de Suscripciones

## Objetivo

Cambiar el comportamiento de los banners de vencimiento para que los tenants no vean la pagina de planes/suscripciones, sino que se les indique contactar al soporte de Geologistick para informar sobre su pago.

## Cambios

### 1. `src/components/trial/TrialBanner.tsx`

Cambiar todos los botones que redirigen a `/subscription` para que en su lugar redirijan a `/support`:
- "Renovar Plan" y "Renovar" -> Redirigir a `/support` con texto "Contactar Soporte"
- "Ver Planes" -> Redirigir a `/support` con texto "Contactar Soporte"
- Actualizar los mensajes secundarios:
  - "Renueva tu plan para seguir usando todas las funcionalidades" -> "Contacta a soporte para informar tu pago"
  - "Renueva a tiempo para no perder acceso" -> "Contacta a soporte para gestionar tu renovacion"
  - "Suscribete para seguir usando todas las funcionalidades" -> "Contacta a soporte para activar tu plan"
  - "Suscribete ahora para no perder acceso" -> "Contacta a soporte para activar tu plan"

### 2. `src/pages/Subscription.tsx`

Para los tenants (no super admin), reemplazar la vista de planes con una pagina informativa que:
- Muestre el resumen de la suscripcion actual (si existe) con uso y limites
- En lugar de la grilla de planes con botones de pago, mostrar un mensaje indicando que deben contactar a soporte para gestionar su suscripcion
- Incluir un boton "Contactar Soporte" que lleve a `/support`
- Eliminar el boton "Cancelar Suscripcion" (ya que todo se gestiona via soporte)

## Detalle tecnico

| Archivo | Cambio |
|---|---|
| `src/components/trial/TrialBanner.tsx` | Cambiar links de `/subscription` a `/support` y textos de botones/mensajes |
| `src/pages/Subscription.tsx` | Reemplazar grilla de planes por mensaje de contacto a soporte para tenants |
