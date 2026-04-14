

## Plan: Corregir visualización y bloqueo de suscripciones vencidas

### Problema
BlackBox tiene `current_period_end = 2026-04-13` (ayer) pero `status = active` en la DB. Dos problemas:

1. **Visual**: En la tabla de "Gestión de Suscripciones" (SuperAdminSubscriptionManager), el badge muestra "Activo" porque lee el campo `status` sin verificar si `current_period_end` ya pasó.
2. **Funcional**: El bloqueo del hook `useSubscriptionBlock` sí funciona correctamente (compara la fecha), pero el estado en DB queda desincronizado.

### Solución

#### 1. `src/components/subscriptions/SuperAdminSubscriptionManager.tsx`
En la tabla de empresas, al mostrar el badge de estado, verificar si `current_period_end < now()`. Si la fecha ya pasó aunque `status === 'active'`, mostrar badge "Vencido" en rojo en lugar de "Activo" en verde.

#### 2. Migración SQL (opcional pero recomendada)
Actualizar el registro de BlackBox para reflejar la realidad:
```sql
UPDATE tenant_subscriptions 
SET status = 'expired' 
WHERE tenant_id = '81be07a7-73a0-4986-994e-5365478343eb' 
AND current_period_end < now();
```

### Archivos a modificar
| Archivo | Cambio |
|---------|--------|
| `src/components/subscriptions/SuperAdminSubscriptionManager.tsx` | Agregar lógica para mostrar "Vencido" cuando `current_period_end < now` |

### Notas
- El bloqueo para usuarios de BlackBox **ya funciona** — ellos ven la pantalla de bloqueo. Solo el super_admin ve "Activo" porque: (a) está exento del bloqueo y (b) la tabla lee `status` sin chequear fecha.
- La corrección es puramente visual en el panel de super admin.

