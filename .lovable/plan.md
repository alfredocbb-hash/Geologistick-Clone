
# Plan: Corregir Aislamiento de Control de Caja por Tenant

## Problema Identificado

El usuario de **BlackBox Cargas** puede ver una caja abierta que pertenece a **Empresa Principal**. Esto ocurre porque las queries en `Cash.tsx` no filtran las sesiones de caja por el tenant del usuario.

### Datos del problema:
| Caja Abierta | Pertenece a | Debería verse por |
|--------------|-------------|-------------------|
| Central Buenos Aires | Empresa Principal | Solo Empresa Principal |
| (ninguna) | BlackBox Cargas | BlackBox Cargas debería ver "sin caja abierta" |

### Causa raíz:
La tabla `sesiones_caja` no tiene columna `tenant_id` directa, pero se relaciona con `sucursales` que sí tiene `tenant_id`. Las queries actuales no filtran a través de esta relación.

---

## Solución

Modificar **`src/pages/Cash.tsx`** para filtrar las sesiones de caja solo a sucursales del tenant del usuario.

### Cambio 1: Query de sesión activa (líneas 142-162)

Actualmente:
```typescript
let query = supabase
  .from('sesiones_caja')
  .select('*')
  .eq('estado', 'abierta');

if (!isAdmin()) {
  query = query.or(`usuario_id.eq.${user.id},sucursal_id.eq.${profile?.sucursal_id}`);
}
```

**Problema:** Para admins no hay filtro de tenant.

**Solución:** Obtener primero las sucursales del tenant y filtrar por ellas:

```typescript
// Obtener IDs de sucursales del tenant actual
const { data: tenantSucursales } = await supabase
  .from('sucursales')
  .select('id')
  .eq('tenant_id', profile?.tenant_id);

const sucursalIds = tenantSucursales?.map(s => s.id) || [];

if (sucursalIds.length === 0) return null;

let query = supabase
  .from('sesiones_caja')
  .select('*')
  .eq('estado', 'abierta')
  .in('sucursal_id', sucursalIds);  // ← FILTRO POR TENANT
```

### Cambio 2: Query de historial (líneas 165-176)

Actualmente:
```typescript
const { data, error } = await supabase
  .from('sesiones_caja')
  .select('*')
  .order('fecha_apertura', { ascending: false })
  .limit(20);
```

**Problema:** Sin filtro de tenant, muestra historial de todos.

**Solución:** Aplicar el mismo filtro:

```typescript
// Obtener IDs de sucursales del tenant
const { data: tenantSucursales } = await supabase
  .from('sucursales')
  .select('id')
  .eq('tenant_id', profile?.tenant_id);

const sucursalIds = tenantSucursales?.map(s => s.id) || [];

const { data, error } = await supabase
  .from('sesiones_caja')
  .select('*')
  .in('sucursal_id', sucursalIds)  // ← FILTRO POR TENANT
  .order('fecha_apertura', { ascending: false })
  .limit(20);
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Cash.tsx` | Agregar filtro de `sucursal_id` basado en el tenant del usuario en ambas queries de sesiones de caja |

---

## Resultado Esperado

| Usuario | Antes | Después |
|---------|-------|---------|
| BlackBox Cargas | Ve caja de "Central Buenos Aires" (otro tenant) | Ve "No hay caja abierta" o solo cajas de su empresa |
| Empresa Principal | Ve cajas de todos | Ve solo cajas de "Empresa Principal" |
| Super Admin | Ve todo | Sigue viendo todo (comportamiento correcto) |

---

## Consideración Adicional

También se debe eliminar el intento de insertar `tenant_id` en las líneas 207 y 276-277 ya que esas columnas no existen en las tablas `sesiones_caja` y `movimientos_caja`. Aunque Supabase ignora columnas inexistentes en inserts, es código muerto que debería limpiarse.
