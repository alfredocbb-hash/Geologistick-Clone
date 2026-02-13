
# Fix: Query de pedidos e-Commerce falla por join incorrecto con profiles

## Problema

La query de pedidos devuelve un error **400** con el mensaje:

> "Could not find a relationship between 'envios' and 'profiles' using the hint 'envios_chofer_id_fkey'"

Esto es porque la FK `envios_chofer_id_fkey` apunta a `auth.users`, no a `profiles`. PostgREST no puede hacer un join directo de `envios.chofer_id` a `profiles` usando esa FK.

**Resultado**: la tabla muestra "No hay pedidos que mostrar" cuando en realidad hay 50 pedidos para hoy.

## Solucion

Eliminar el join anidado `chofer:profiles!envios_chofer_id_fkey(nombre, apellido)` de ambas queries y obtener los nombres de choferes por separado con una segunda consulta liviana.

### Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `src/pages/ecommerce/Orders.tsx` | Quitar el join de chofer de la query principal. Agregar una segunda query para traer los nombres de choferes a partir de los `chofer_id` encontrados en los envios. |
| `src/pages/Shipments.tsx` | Mismo cambio: quitar `chofer:profiles!envios_chofer_id_fkey(...)` y obtener nombres con query separada. |

### Detalle tecnico

**En Orders.tsx:**

1. Cambiar la query de:
```
envio:envios!ecommerce_orders_envio_id_fkey(tracking_number, estado, chofer_id, chofer:profiles!envios_chofer_id_fkey(nombre, apellido))
```
a:
```
envio:envios!ecommerce_orders_envio_id_fkey(tracking_number, estado, chofer_id)
```

2. Despues de obtener los pedidos, recolectar los `chofer_id` unicos de los envios y hacer una query separada a `profiles` para obtener `nombre` y `apellido`:
```typescript
const choferIds = [...new Set(data.map(o => o.envio?.chofer_id).filter(Boolean))];
const { data: choferProfiles } = await supabase
  .from('profiles')
  .select('user_id, nombre, apellido')
  .in('user_id', choferIds);
```

3. Mapear los nombres al renderizar usando un `Map<string, string>` de chofer_id a nombre completo.

**En Shipments.tsx:**

1. Quitar `chofer:profiles!envios_chofer_id_fkey(nombre, apellido)` del select.
2. Agregar query separada a `profiles` con los `chofer_id` unicos.
3. Renderizar el nombre del chofer usando el mapa.

Este enfoque evita el problema de la FK hacia `auth.users` y funciona correctamente con PostgREST.
