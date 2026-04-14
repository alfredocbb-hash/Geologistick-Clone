

## Plan: Corregir bloqueo de suscripción para TODOS los usuarios de un tenant

### Problema encontrado

La tabla `tenant_subscriptions` tiene una política RLS que solo permite lectura a **admins**:

```sql
-- Policy actual: "Tenant admins can view subscription"
(tenant_id = current_user_tenant()) AND (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
```

Esto significa que los usuarios con rol `chofer`, `sucursal` o `despachador` no pueden leer la suscripción. Cuando la query no devuelve datos, el hook lo interpreta como "sin suscripción configurada" y **permite el acceso** (línea 55 de `useSubscriptionBlock.ts`).

### BlackBox actualmente
- Plan: `professional`, suscripción con status `expired`, vencida el 13/04/2026
- 16 usuarios activos (1 admin, 1 chofer, 14 sucursal/despachador)
- Solo el admin `blackboxcargas@gmail.com` estaría siendo bloqueado; el resto pasa sin bloqueo

### Solución

| Cambio | Detalle |
|--------|---------|
| **Migración SQL** | Agregar política RLS para que **cualquier usuario autenticado** pueda leer la suscripción de **su propio tenant** (solo SELECT, solo columnas `status` y `current_period_end`) |

```sql
CREATE POLICY "All users can view own tenant subscription"
ON public.tenant_subscriptions
FOR SELECT
TO authenticated
USING (tenant_id = current_user_tenant());
```

Esto permite que chofer, sucursal, despachador lean el status de suscripción y sean bloqueados correctamente cuando está vencida.

No se requieren cambios en el código frontend: el hook `useSubscriptionBlock.ts` ya tiene la lógica correcta, solo faltaba que la query pudiera ejecutarse para usuarios no-admin.

