

# Fix: Nombre del partner no aparece en Empresas Asociadas

## Causa raíz
La tabla `tenants` tiene RLS que solo permite ver **el propio tenant** del usuario (`id = current_user_tenant()`). Cuando el hook `usePartners` intenta obtener el nombre del tenant asociado con `supabase.from('tenants').select('id, nombre').in('id', [...])`, la query devuelve vacío para el otro tenant porque RLS lo bloquea. Por eso se muestra "Empresa" (el fallback).

## Solución
Agregar una política RLS en `tenants` que permita ver tenants con los que se tiene una partnership activa o pendiente.

### 1. Migración SQL — nueva política RLS en `tenants`

```sql
CREATE POLICY "Users can view partner tenants"
ON public.tenants FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_partners tp
    WHERE (tp.tenant_a_id = id OR tp.tenant_b_id = id)
    AND public.current_user_tenant() IN (tp.tenant_a_id, tp.tenant_b_id)
  )
);
```

Esto permite que un usuario vea los datos básicos de cualquier tenant con el que tenga una partnership (en cualquier estado), sin exponer tenants no relacionados.

### Archivos
| Cambio | Archivo |
|--------|---------|
| Nueva política RLS | Migración SQL |

No se necesitan cambios en el código frontend — el hook ya intenta leer los nombres, solo falla por RLS.

