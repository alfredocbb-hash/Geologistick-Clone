

# Corregir: Pedidos de e-commerce no aparecen en el planificador

## Problema

Cuando seleccionas pedidos en el modulo de e-commerce y haces click en "Planificar", la navegacion al planificador funciona correctamente (los IDs de envios se pasan por URL). Sin embargo, el planificador **no muestra esos envios** porque su consulta a la base de datos filtra con `.is("chofer_id", null)` (linea 210 de RoutePlanner.tsx).

Los envios de e-commerce que intentas planificar ya tienen un `chofer_id` asignado (todos apuntan al mismo chofer). Por eso, el planificador los excluye de la consulta y muestra el mensaje "Envios no disponibles".

## Solucion

### Archivo: `src/pages/RoutePlanner.tsx`

Modificar la consulta de envios pendientes para que los envios que vienen explicitamente desde la URL (parametro `?envios=`) **no sean excluidos** por el filtro de `chofer_id`. Esto se logra haciendo dos consultas:

1. La consulta normal (con filtro `chofer_id IS NULL`) para los envios pendientes generales
2. Una consulta adicional para los envios que vienen por URL, sin el filtro de `chofer_id`

Luego se combinan ambos resultados eliminando duplicados.

```text
Antes:
  query con .is("chofer_id", null) -> excluye envios con chofer asignado

Despues:
  query 1: envios sin chofer (lista general)
  query 2: envios de la URL (sin filtro chofer_id)
  resultado: union de ambos (sin duplicados)
```

### Detalle tecnico

En la funcion `queryFn` del query `envios-planificador` (lineas ~198-250):

1. Extraer los IDs de la URL antes de la consulta principal
2. Si hay IDs en la URL, hacer una segunda consulta sin el filtro `.is("chofer_id", null)` solo para esos IDs
3. Combinar los resultados, priorizando los de la URL

Esto permite que los envios ya asignados a un chofer puedan ser re-planificados desde el modulo de e-commerce, sin afectar el comportamiento normal del planificador.

## Sin cambios de base de datos
No se necesitan migraciones.
