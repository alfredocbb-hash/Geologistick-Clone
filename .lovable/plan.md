
# Plan: Corregir Acceso de Super Admin en tiendanube-sync

## Problema Identificado

La función `tiendanube-sync` devuelve **403 Access Denied** porque:

1. El usuario actual (`14cab849...`) pertenece al tenant `a0000000...`
2. El seller "Brysha Siempre" pertenece al tenant `94a9ea85...`
3. La validación en línea 83 compara ambos tenant_ids y falla
4. **El usuario es super_admin** pero la función NO considera este caso especial

## Solución

Modificar la validación de acceso para permitir que los **super_admin** puedan sincronizar sellers de cualquier tenant.

## Archivo a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/tiendanube-sync/index.ts` | Agregar verificación de super_admin antes de rechazar acceso |

---

## Cambio Técnico

### Código Actual (líneas 76-88):

```typescript
// Verify user belongs to same tenant
const { data: profile } = await supabase
  .from("profiles")
  .select("tenant_id")
  .eq("user_id", userId)
  .single();

if (!profile || profile.tenant_id !== seller.tenant_id) {
  return new Response(
    JSON.stringify({ error: "Access denied" }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### Código Propuesto:

```typescript
// Verify user belongs to same tenant OR is super_admin
const { data: profile } = await supabase
  .from("profiles")
  .select("tenant_id")
  .eq("user_id", userId)
  .single();

// Check if user is super_admin
const { data: isSuperAdmin } = await supabase
  .from("user_roles")
  .select("role")
  .eq("user_id", userId)
  .eq("role", "super_admin")
  .maybeSingle();

const canAccess = isSuperAdmin || (profile && profile.tenant_id === seller.tenant_id);

if (!canAccess) {
  return new Response(
    JSON.stringify({ error: "Access denied" }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

---

## Resultado Esperado

- Los **super_admin** podrán sincronizar sellers de cualquier tenant (para soporte y testing)
- Los usuarios normales solo podrán sincronizar sellers de su propio tenant
- Se mantiene la seguridad multi-tenant para usuarios no privilegiados
