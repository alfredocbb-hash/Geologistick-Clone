

## Plan: Excluir envíos ya asignados a rutas activas del planificador

### Problema
La query del planificador (línea 238) usa `.or("chofer_id.is.null,reprogramado_count.gt.0")`, lo que permite que envíos con `chofer_id` asignado y `reprogramado_count > 0` aparezcan. Pero incluso envíos sin `reprogramado_count` podrían filtrarse mal. El problema real: no se verifica si el envío ya pertenece a una `ruta_parada` de una ruta activa.

### Solución

**Archivo**: `src/pages/RoutePlanner.tsx`

1. **Después de obtener los envíos pendientes**, consultar `ruta_paradas` de rutas activas (`pendiente`, `confirmada`, `en_curso`) para obtener todos los `envio_id` ya asignados a rutas.

2. **Filtrar** en el frontend: excluir del listado cualquier envío cuyo `id` esté en ese set de IDs de paradas activas (excepto los que vengan por URL).

Cambio concreto en la `queryFn` (después de línea 270):
- Consultar `ruta_paradas` con join a `rutas_planificadas` donde estado IN (`pendiente`, `confirmada`, `en_curso`), obtener los `envio_id`.
- En el filtro de línea 273, agregar condición: si `envio.id` está en el set de envíos en rutas activas, excluirlo (salvo URL-specified).

```text
// Pseudocódigo del cambio:
const { data: paradasActivas } = await supabase
  .from('ruta_paradas')
  .select('envio_id, ruta:rutas_planificadas!inner(estado)')
  .in('ruta.estado', ['pendiente', 'confirmada', 'en_curso']);

const enviosEnRutaActiva = new Set(paradasActivas?.map(p => p.envio_id));

// En el filtro (línea 273):
if (enviosEnRutaActiva.has(envio.id) && !urlEnvioIds.has(envio.id)) return false;
```

### Archivos a modificar
- `src/pages/RoutePlanner.tsx` — Agregar consulta de paradas activas y filtrar envíos ya en ruta

