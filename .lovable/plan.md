

# Plan: Corregir Carga de Tarifas para el Usuario

## Diagnóstico del Problema

El usuario `clientes@beraexpress.com` (Maricel Bernard) tiene correctamente configurado:
- **Tenant ID**: `94a9ea85-43c5-49ac-9bfa-86843072c2ce`
- **Sucursal**: Berazategui
- **Roles**: `sucursal`, `despachador`
- **Tarifas activas en su tenant**: "CABA Y GBA" y "SOLO RETIRO"

Sin embargo, la tarifa no carga. El problema está en el **timing de la query**:

### Causa Raíz

La query de tarifas se ejecuta **inmediatamente** al cargar el componente:

```tsx
const { data: tarifas } = useQuery({
  queryKey: ['tarifas'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('tarifas')
      .select('*')
      .eq('activa', true)
      .order('nombre');
    if (error) throw error;
    return data;
  },
  // ⚠️ NO HAY `enabled` - Se ejecuta antes de que el perfil esté listo
});
```

La política RLS de tarifas usa `current_user_tenant()`:
```sql
qual: (tenant_id = current_user_tenant()) OR is_super_admin(auth.uid())
```

Si la query se ejecuta **antes** de que el perfil del usuario esté completamente cargado en la sesión, `current_user_tenant()` puede devolver `NULL` y no retorna ninguna tarifa.

---

## Solución Propuesta

### Paso 1: Agregar condición `enabled` a la query de tarifas

Modificar la query para que solo se ejecute cuando el usuario y su perfil estén cargados:

```tsx
const { data: tarifas, isLoading: loadingTarifas, refetch: refetchTarifas } = useQuery({
  queryKey: ['tarifas', profile?.tenant_id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('tarifas')
      .select('*')
      .eq('activa', true)
      .order('nombre');
    if (error) throw error;
    return data;
  },
  enabled: !!user && !!profile,  // Solo ejecutar cuando el usuario y perfil estén listos
});
```

### Paso 2: Agregar indicador de carga en el selector de tarifas

Mostrar un estado de carga mientras las tarifas se están obteniendo:

```tsx
<Select
  value={formData.tarifa_id}
  onValueChange={(v) => handleChange('tarifa_id', v)}
  disabled={loadingTarifas}
>
  <SelectTrigger>
    <SelectValue placeholder={loadingTarifas ? "Cargando tarifas..." : "Seleccionar tarifa"} />
  </SelectTrigger>
  <SelectContent>
    {loadingTarifas ? (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span>Cargando...</span>
      </div>
    ) : tarifas?.length === 0 ? (
      <div className="py-4 text-center text-muted-foreground">
        No hay tarifas disponibles
      </div>
    ) : (
      tarifas?.map((t) => (
        <SelectItem key={t.id} value={t.id}>
          {t.nombre} - ${Number(t.precio_base).toLocaleString('es-AR')}
        </SelectItem>
      ))
    )}
  </SelectContent>
</Select>
```

### Paso 3: Agregar retry automático si no hay tarifas

Si las tarifas no cargan, permitir un botón de reintentar:

```tsx
{!loadingTarifas && tarifas?.length === 0 && (
  <Button 
    variant="outline" 
    size="sm" 
    onClick={() => refetchTarifas()}
    className="mt-2"
  >
    <Loader2 className="h-4 w-4 mr-2" />
    Reintentar carga de tarifas
  </Button>
)}
```

---

## Resumen de Cambios

| Archivo | Cambio |
|---------|--------|
| `src/pages/NewShipment.tsx` | Agregar `enabled: !!user && !!profile` a la query de tarifas |
| `src/pages/NewShipment.tsx` | Incluir `profile?.tenant_id` en el `queryKey` para invalidar cache al cambiar usuario |
| `src/pages/NewShipment.tsx` | Agregar estado de carga (`isLoading`) al selector de tarifas |
| `src/pages/NewShipment.tsx` | Mostrar mensaje cuando no hay tarifas disponibles |
| `src/pages/NewShipment.tsx` | Agregar botón "Reintentar" si las tarifas no cargan |

---

## Sección Técnica

### Por qué esto soluciona el problema

1. **`enabled: !!user && !!profile`**: Garantiza que la query no se ejecute hasta que:
   - El usuario esté autenticado (`user`)
   - El perfil del usuario esté cargado (`profile`)
   
   Esto asegura que cuando la query llegue al backend, `auth.uid()` y `current_user_tenant()` devuelvan valores correctos.

2. **`queryKey: ['tarifas', profile?.tenant_id]`**: Si el usuario cambia de sesión o se actualiza el perfil, React Query invalida la cache y vuelve a ejecutar la query con los datos correctos.

3. **Estados visuales**: El usuario ahora verá claramente si las tarifas están cargando, si no hay tarifas, o si puede reintentar.

### Impacto Esperado

- Las tarifas cargarán correctamente para el usuario `clientes@beraexpress.com`
- Se evitarán problemas similares para cualquier usuario
- Mejor experiencia de usuario con indicadores de carga claros

