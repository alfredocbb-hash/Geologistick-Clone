

# Bug: Movimiento de caja de seller de otro tenant aparece en caja equivocada

## Problema

En `src/pages/ecommerce/Settlements.tsx`, línea 902-908, cuando se paga una liquidación de seller en efectivo, el código busca la sesión de caja abierta **sin filtrar por sucursal ni por tenant**:

```typescript
const { data: sesion } = await supabase
  .from('sesiones_caja')
  .select('id')
  .eq('estado', 'abierta')
  .order('fecha_apertura', { ascending: false })
  .limit(1)
  .maybeSingle();
```

Esto devuelve **cualquier caja abierta del sistema**, por lo que si Beraexpress pagó una liquidación del seller ABRAHAM ARDEBACO mientras la caja de Bahía Blanca (BlackBox) estaba abierta, el egreso se registró en la caja equivocada.

## Solución

Filtrar la sesión de caja por la sucursal del usuario logueado:

```typescript
// Obtener sucursal del usuario
const { data: userProfile } = await supabase
  .from('profiles')
  .select('sucursal_id')
  .eq('user_id', user?.id)
  .maybeSingle();

if (userProfile?.sucursal_id) {
  const { data: sesion } = await supabase
    .from('sesiones_caja')
    .select('id')
    .eq('estado', 'abierta')
    .eq('sucursal_id', userProfile.sucursal_id)
    .order('fecha_apertura', { ascending: false })
    .limit(1)
    .maybeSingle();
  // ...
}
```

Adicionalmente, **eliminar el movimiento erróneo** de la caja de BlackBox (id: `83ddcd2e-...`).

### Revisar otros usos del mismo patrón

Buscar en todo el codebase si hay otros lugares donde se busca `sesiones_caja` sin filtrar por sucursal/tenant, y corregirlos también.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/ecommerce/Settlements.tsx` | Filtrar sesión de caja por `sucursal_id` del usuario |
| Migración SQL | Eliminar el movimiento erróneo `83ddcd2e-8131-4ad9-af8f-ed8243ca5ffb` de la caja de BlackBox |

