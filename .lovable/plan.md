

# Fix: "Continuar Ruta" sigue apareciendo despues de finalizar

## Problema

La ruta FLX-20260211-ZWXC tiene estado `completada` en la base de datos, pero la pantalla de inicio del chofer sigue mostrando "RUTA ACTIVA" con el boton "Continuar Ruta".

La causa es que cuando se finaliza una ruta en `ActiveRouteNavigation.tsx`, solo se invalidan los queries `my-hojas-ruta` y `my-rutas-planificadas`, pero **no** los queries del home tab movil (`mobile-rutas-planificadas` y `mobile-hojas-ruta`). Esto deja datos en cache obsoletos en la pantalla de inicio.

## Solucion

Agregar la invalidacion de los queries del home tab al momento de completar la ruta.

## Cambio

| Archivo | Cambio |
|---------|--------|
| `src/pages/ActiveRouteNavigation.tsx` | Agregar invalidacion de `mobile-rutas-planificadas` y `mobile-hojas-ruta` en el `onSuccess` de la mutacion de cierre de ruta |

## Detalle tecnico

En la mutacion de cierre de ruta (alrededor de linea 389), agregar:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['my-hojas-ruta'] });
  queryClient.invalidateQueries({ queryKey: ['my-rutas-planificadas'] });
  // NUEVO: Invalidar cache del home tab movil
  queryClient.invalidateQueries({ queryKey: ['mobile-rutas-planificadas'] });
  queryClient.invalidateQueries({ queryKey: ['mobile-hojas-ruta'] });
  toast.success('Ruta completada!');
  navigate('/my-routes');
},
```

Tambien agregar la misma invalidacion en el bloque `onError` donde se detecta que la ruta ya fue completada (linea 396).

## Resultado esperado

Al finalizar una ruta, la pantalla de inicio se refresca automaticamente y muestra "No hay rutas activas" en lugar del card de "Continuar Ruta".

## Recordatorio

Publicar los cambios para que la app Android los tome.

