

## Plan: Corregir agregado de envíos reprogramados a la planificación

### Problema

Cuando seleccionás envíos en la pestaña **Reprogramados** y hacés clic en "Agregar a Nueva Ruta", los IDs se agregan a `selectedEnvios` y se cambia a la pestaña "Crear Ruta". Pero los envíos no aparecen porque la consulta principal del planificador (`envios-planificador`) filtra con:

```
.or("chofer_id.is.null,reprogramado_count.gt.0")
```

Esto excluye envíos con estado `primera_visita` o `segunda_visita` que tienen `reprogramado_count = 0` y un `chofer_id` asignado (como se ve en la captura con "0x reprogramado").

### Solución

Ampliar el filtro de la query principal en `src/pages/RoutePlanner.tsx` (~línea 240) para incluir también envíos en estados de visita:

```typescript
// Antes:
.or("chofer_id.is.null,reprogramado_count.gt.0")

// Después:
.or("chofer_id.is.null,reprogramado_count.gt.0,estado.in.(primera_visita,segunda_visita)")
```

Esto asegura que los envíos con visitas previas (que aparecen en la pestaña Reprogramados) también estén disponibles en la lista del planificador y puedan seleccionarse correctamente.

### Archivo a modificar
- `src/pages/RoutePlanner.tsx` — una línea en la query de envíos pendientes

