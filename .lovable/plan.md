

# Fix: Plan asignado no se muestra en la tabla

## Problema

Cuando el super admin asigna un plan, el dato se guarda correctamente en la base de datos, pero la tabla sigue mostrando "Sin plan". La respuesta de la API muestra `"tenant_subscriptions": null` para TODOS los tenants.

## Causa raiz

PostgREST tiene un comportamiento conocido donde las consultas anidadas (embedded resources) no siempre respetan correctamente las politicas RLS `FOR ALL`. La consulta actual usa un select anidado:

```
tenants -> tenant_subscriptions -> subscription_plans
```

Y aunque el super admin tiene una politica `FOR ALL`, PostgREST no devuelve los datos anidados de `tenant_subscriptions`.

## Solucion

Cambiar la estrategia de consulta: en lugar de depender del select anidado de PostgREST, hacer 2 queries separadas y unirlas en JavaScript.

### Cambio en `SuperAdminSubscriptionManager.tsx`

1. **Query 1**: Obtener todos los tenants (sin nested select)
2. **Query 2**: Obtener todas las `tenant_subscriptions` con su `subscription_plans` por separado
3. **Merge**: Combinar los datos en el frontend usando `tenant_id` como clave

```text
Antes:
  tenants.select("..., tenant_subscriptions(...)") -> null por RLS

Despues:
  Query A: tenants.select("id, nombre, slug, activo, plan")
  Query B: tenant_subscriptions.select("*, subscription_plans(*)")
  Merge: tenants.map(t => ({...t, sub: subs.find(s => s.tenant_id === t.id)}))
```

Ademas, agregar una politica RLS explicita `FOR SELECT` en `tenant_subscriptions` para super admins, para asegurar que la query directa funcione:

```sql
CREATE POLICY "Super admins can select all subscriptions"
ON public.tenant_subscriptions
FOR SELECT
USING (current_user_is_super_admin());
```

## Detalle tecnico

| Archivo | Cambio |
|---|---|
| Migracion SQL | Agregar politica SELECT explicita para super_admin en tenant_subscriptions |
| `src/components/subscriptions/SuperAdminSubscriptionManager.tsx` | Separar query de tenants y subscriptions, merge en JS |
