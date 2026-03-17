
# Plan: Corregir RLS de tenants asociados para que deje de mostrar "Empresa"

## Qué está pasando
El frontend está bien: `usePartners()` sí intenta traer `id, nombre` desde `tenants` y solo muestra `"Empresa"` cuando esa query vuelve vacía.

Revisé las políticas activas y la nueva policy quedó mal evaluada en base de datos. Hoy aparece así:

```sql
EXISTS (
  SELECT 1
  FROM tenant_partners tp
  WHERE (((tp.tenant_a_id = tp.id) OR (tp.tenant_b_id = tp.id))
    AND ((current_user_tenant() = tp.tenant_a_id) OR (current_user_tenant() = tp.tenant_b_id)))
)
```

Ese `id` se está resolviendo incorrectamente dentro del `EXISTS`, por eso la condición nunca matchea y el tenant partner sigue oculto por RLS. Resultado: el hook no recibe el nombre y cae en el fallback `"Empresa"`.

## Solución
Reemplazar la policy defectuosa por una versión que compare explícitamente contra la fila de `tenants` usando alias de tabla, evitando ambigüedad de columnas.

## Cambio a implementar

### 1. Nueva migración SQL
Eliminar la policy actual y crearla correctamente:

```sql
DROP POLICY IF EXISTS "Users can view partner tenants" ON public.tenants;

CREATE POLICY "Users can view partner tenants"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenant_partners tp
    WHERE
      (
        tp.tenant_a_id = tenants.id
        OR tp.tenant_b_id = tenants.id
      )
      AND public.current_user_tenant() IN (tp.tenant_a_id, tp.tenant_b_id)
  )
);
```

## Por qué esto lo corrige
Con `tenants.id` ya no hay ambigüedad: la policy evalúa si el tenant de la fila actual participa en una asociación donde también participa el tenant del usuario autenticado.

Eso habilita a leer el nombre del partner sin abrir visibilidad sobre tenants no relacionados.

## Archivos afectados
| Tipo | Archivo |
|---|---|
| Base de datos | nueva migración en `supabase/migrations/` |

## Validación después del cambio
1. Entrar a **Empresas Asociadas**
2. Verificar que en la columna **Empresa** aparezca el nombre real del tenant asociado
3. Confirmar que solo se ven tenants vinculados y no empresas ajenas

## Nota técnica
No hace falta tocar `src/hooks/usePartners.ts`; el problema real está en la policy ya aplicada, no en el render.
