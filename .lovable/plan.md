

# Fix: Buscador de clientes en terciarizados no muestra todos los resultados

## Problema

El componente `ContactAutocomplete` deduplica clientes usando la clave `telefono + nombre`. Muchos clientes tienen el telefono vacio y el mismo `nombre` (ej: "BANCO" para todas las sucursales de bancos), por lo que el sistema los considera duplicados y solo muestra el primero. Esto hace que clientes como "BANCO SANTANDER SUC 099" no aparezcan si ya existe otro "BANCO" con telefono vacio.

Ademas, la busqueda no incluye el campo `direccion`, que es el principal diferenciador cuando hay clientes con el mismo nombre.

## Solucion

Modificar `src/components/shipments/ContactAutocomplete.tsx`:

1. **Cambiar la clave de deduplicacion** de `telefono-nombre` a `nombre-apellido-direccion`, que es un identificador mas unico para clientes reales.

2. **Agregar busqueda por direccion**, para que el usuario pueda encontrar clientes buscando por calle o ciudad.

3. **Aumentar el limite de resultados visibles** de 10 a 15 para mejorar la experiencia cuando hay muchos resultados similares.

## Cambios

| Archivo | Cambio |
|---|---|
| `src/components/shipments/ContactAutocomplete.tsx` | Cambiar clave de deduplicacion, agregar direccion al filtro de busqueda, aumentar limite de resultados |

### Detalle tecnico

- Deduplicacion: `${client.nombre}-${client.apellido}-${client.direccion}` en lugar de `${client.telefono}-${client.nombre}`
- Filtro: agregar `const address = client.direccion?.toLowerCase() || ''` y `address.includes(searchLower)` a la condicion OR
- Limite: cambiar `.slice(0, 10)` a `.slice(0, 15)`

