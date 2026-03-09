

# Fix: Conceptos no cargan al configurar comisiones de sucursales (super admin)

## Problema

Al abrir el diálogo de comisiones de BERAZATEGUI (o cualquier sucursal de Blackbox), aparece "No hay conceptos configurados", aunque el tenant tiene 6 conceptos activos (Flete, Seguro, Retiro, Entrega, Agencia, Traslado).

## Causa raíz

La query de conceptos (línea 189) filtra por `tenant_id = tenantId`, donde `tenantId` viene de `useTenant()`. Para super admins, `useTenant()` devuelve `null` (está deshabilitado para ellos), por lo que la query nunca se ejecuta (`enabled: !!tenantId`).

Las sucursales que ya tienen comisiones las tuvieron configuradas previamente (probablemente por un admin de Blackbox, no por super admin).

## Solución

En `src/pages/Branches.tsx`, derivar el `tenant_id` para la query de conceptos desde la sucursal seleccionada (que tiene `tenant_id` en sus datos) en lugar de depender exclusivamente del hook `useTenant()`.

### Cambios:

1. **Incluir `tenant_id` en la interfaz `Sucursal`** — la query ya hace `select('*')`, solo falta tiparlo.

2. **Derivar `effectiveTenantId`** — usar el `tenant_id` de la sucursal seleccionada para comisiones, con fallback al `tenantId` del usuario:
```typescript
const effectiveTenantId = selectedSucursalForCommissions?.tenant_id || tenantId;
```

3. **Actualizar la query de conceptos** — usar `effectiveTenantId` en lugar de `tenantId`:
```typescript
const { data: conceptos = [] } = useQuery({
  queryKey: ['tarifa_conceptos', effectiveTenantId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('tarifa_conceptos')
      .select('*')
      .eq('activo', true)
      .eq('tenant_id', effectiveTenantId)
      .order('orden');
    if (error) throw error;
    return data as TarifaConcepto[];
  },
  enabled: !!effectiveTenantId,
});
```

Esto permite que un super admin vea los conceptos del tenant correspondiente a la sucursal que está configurando.

| Archivo | Cambio |
|---------|--------|
| `src/pages/Branches.tsx` | Agregar `tenant_id` a interfaz Sucursal, derivar tenant desde sucursal seleccionada, actualizar query de conceptos |

