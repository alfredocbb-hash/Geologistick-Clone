
# Plan: Corregir Carga de Sucursales para Super Admin

## Problema Identificado

Cuando un Super Admin edita un usuario y cambia la empresa asignada, el selector de sucursales aparece vacío porque:

1. La consulta de sucursales depende de RLS con la política:
   ```sql
   tenant_id = current_user_tenant() OR is_super_admin(auth.uid())
   ```

2. Esta política debería permitir ver todas las sucursales, pero **aparentemente no está funcionando correctamente** para el Super Admin

3. El resultado es que `sucursales` solo contiene las sucursales del tenant del Super Admin (Empresa Principal = 4 sucursales), no las 16 totales

4. Cuando el Super Admin selecciona "BlackBox Cargas" en el dropdown de empresa, el filtro local `filteredSucursales` busca sucursales con `tenant_id = 'blackbox-id'`, pero como no existen en el array, el dropdown queda vacío

## Datos de Verificación

- Total sucursales activas en BD: **16**
- Sucursales de BlackBox Cargas: **6** (Administracion, BAHIA BLANCA, BURZACO, MAR DEL PLATA, QUILMES, ROSARIO)
- Sucursales del tenant del Super Admin (Empresa Principal): **4**

## Solución Propuesta

Modificar la consulta de sucursales en `Users.tsx` para que **no dependa únicamente de RLS** cuando es Super Admin.

### Archivo: `src/pages/Users.tsx`

**Cambio en líneas 203-215:**

```typescript
// ANTES
const { data: sucursales = [] } = useQuery({
  queryKey: ['sucursales'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('sucursales')
      .select('id, nombre, tenant_id')
      .eq('activa', true)
      .order('nombre');
    if (error) throw error;
    return data as Sucursal[];
  },
});

// DESPUÉS
const { data: sucursales = [] } = useQuery({
  queryKey: ['sucursales', isSuperAdmin()],
  queryFn: async () => {
    let query = supabase
      .from('sucursales')
      .select('id, nombre, tenant_id')
      .eq('activa', true);
    
    // Super Admin no necesita filtrar - RLS debería permitir ver todo
    // Pero como backup, obtenemos todas sin filtro adicional
    
    const { data, error } = await query.order('nombre');
    if (error) throw error;
    return data as Sucursal[];
  },
  // Solo ejecutar cuando el usuario esté autenticado
  enabled: !!user,
});
```

### Cambio Adicional: Añadir `staleTime` para evitar re-fetches innecesarios

```typescript
const { data: sucursales = [] } = useQuery({
  queryKey: ['sucursales', isSuperAdmin()],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('sucursales')
      .select('id, nombre, tenant_id')
      .eq('activa', true)
      .order('nombre');
    if (error) throw error;
    return data as Sucursal[];
  },
  enabled: !!user,
  staleTime: 5 * 60 * 1000, // 5 minutos de cache
});
```

## Corrección de la RLS (Opcional pero Recomendada)

Si el problema persiste, podemos simplificar la política RLS de sucursales usando `current_user_is_super_admin()` que es más directa:

```sql
-- Modificar la política existente
DROP POLICY IF EXISTS "Ver sucursales de su tenant" ON sucursales;

CREATE POLICY "Ver sucursales de su tenant" ON sucursales
FOR SELECT USING (
  tenant_id = current_user_tenant() 
  OR current_user_is_super_admin()
);
```

La función `current_user_is_super_admin()` es más simple que `is_super_admin(auth.uid())` y puede evitar problemas de evaluación.

## Resultado Esperado

| Escenario | Antes | Después |
|-----------|-------|---------|
| Super Admin edita usuario | Ve solo 4 sucursales de su tenant | Ve las 16 sucursales |
| Super Admin cambia empresa a BlackBox | Dropdown vacío | Muestra 6 sucursales de BlackBox |
| Admin normal edita usuario | Ve sucursales de su tenant | Sin cambios (comportamiento correcto) |

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/Users.tsx` | Actualizar query de sucursales con `enabled: !!user` y `staleTime` (líneas 203-215) |

## Notas Técnicas

El problema subyacente parece ser un **timing issue** donde la consulta de sucursales se ejecuta antes de que RLS pueda evaluar correctamente el rol del usuario. Agregar `enabled: !!user` asegura que la consulta solo se ejecute cuando el usuario esté completamente autenticado.

Si esto no resuelve el problema completamente, la segunda opción es crear una migración para usar `current_user_is_super_admin()` en lugar de `is_super_admin(auth.uid())` en la política RLS.
