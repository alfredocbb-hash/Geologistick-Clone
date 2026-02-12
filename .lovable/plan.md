

# Fix: Reprogramar no avanza a la siguiente parada

## Problema

Cuando el chofer presiona "Reprogramar", el RPC `reschedule_envio` cambia el `chofer_id` a `NULL` y el `estado` a `pendiente`. Sin embargo, el filtro que deberia excluir estos envios los esta incluyendo por error:

```
// Linea 256-258 actual (BUGGED):
const envios = allEnvios.filter(item => 
  !item.envio?.chofer_id || item.envio.chofer_id === user?.id
);
```

`!null` = `true`, asi que los envios rescheduled pasan el filtro y siguen apareciendo en la lista. La logica de `nextStop` los encuentra como pendientes y la vista se queda trabada en la misma parada.

## Solucion

Cambiar el filtro para que **solo incluya envios asignados al chofer actual**. Los envios reprogramados (chofer_id = NULL) quedan excluidos automaticamente.

## Cambio

| Archivo | Cambio |
|---------|--------|
| `src/pages/ActiveRouteNavigation.tsx` | Corregir filtro en linea 256 para excluir envios con `chofer_id` nulo |

## Detalle tecnico

Reemplazar el filtro actual por:

```typescript
const envios = allEnvios.filter(item => {
  const envio = item.envio;
  if (!envio) return false;
  // Para rutas planificadas: solo mostrar envios asignados a este chofer
  // Los reprogramados tienen chofer_id = NULL y se excluyen
  if (isPlannedRoute) {
    return envio.chofer_id === user?.id;
  }
  // Para hojas de ruta: la asociacion es via hoja_ruta_envios,
  // excluir solo si chofer_id fue reasignado a otro usuario
  return !envio.chofer_id || envio.chofer_id === user?.id;
});
```

Para `ruta_planificada` (tipo FLX que usa el usuario), exigimos que `chofer_id` coincida con el usuario actual. Los envios reprogramados con `chofer_id = NULL` se excluyen inmediatamente.

Para `hoja_ruta`, mantenemos la logica actual porque la asociacion es a traves de la tabla `hoja_ruta_envios` y algunos envios podrian no tener `chofer_id` asignado directamente.

## Resultado esperado

Al presionar "Reprogramar" en una ruta FLX, el envio desaparece de la lista y la vista avanza automaticamente a la siguiente parada pendiente.
