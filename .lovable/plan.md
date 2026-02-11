
## Qué está pasando (reformulado)
En la app del chofer, al tocar **Reprogramar** el backend sí ejecuta la acción (la entrega queda con nueva fecha y se desasigna del chofer), pero **en la pantalla de ruta activa el sistema sigue mostrando esa misma parada como “Próxima entrega”**, por lo que el chofer no puede avanzar a la siguiente.

## Diagnóstico (lo que encontré en el código + datos)
1. **El backend sí está aplicando la reprogramación**  
   Verifiqué registros recientes en historial: se crean entradas tipo “Entrega reprogramada…” y el envío queda con:
   - `estado = 'pendiente'`
   - `chofer_id = NULL`
   - `fecha_entrega` actualizada
   Esto confirma que “los cambios fueron efectuados” en el backend.

2. **El “optimistic update” no está impactando el cache que usa la pantalla**
   - `ActiveRouteNavigation.tsx` consulta con keys:
     - `['my-active-route-paradas', routeId]`
     - `['my-active-route-envios-hoja', routeId]`
   - Pero `RescheduleDialog.tsx` estaba intentando actualizar:
     - `['my-active-route-paradas']` (sin `routeId`)
     - `['my-active-route-envios-hoja']` (sin `routeId`)
   En TanStack Query, `getQueryData/setQueryData` con una key incompleta **no actualiza** las entradas que realmente está usando la vista (match exacto). Por eso el envío no desaparece “en el acto”.

3. **Aun después del refetch puede volver a aparecer**
   Aunque el envío queda con `chofer_id = NULL`, la query de `ActiveRouteNavigation` actualmente **no trae `chofer_id`** dentro del nested select de `envios`, y además la lógica de “próxima parada” no filtra por asignación.  
   Resultado: incluso si el backend lo desasigna, la UI puede seguir considerándolo pendiente y “clavarse” en esa parada.

## Do I know what the issue is?
Sí:
- (A) el optimistic update está apuntando a la key equivocada (le falta `routeId`).
- (B) la vista no filtra/ignora envíos desasignados (`chofer_id = NULL`), así que pueden seguir contando como “pendientes” para el chofer.

## Solución propuesta (cambios concretos)

### Cambio 1 — Corregir el optimistic update para que funcione con keys que incluyen `routeId`
**Archivo:** `src/components/driver/RescheduleDialog.tsx`

**Qué voy a hacer**
- En `onMutate`, en vez de usar `getQueryData/setQueryData` con key “base”, voy a:
  - Usar `queryClient.getQueriesData({ queryKey: ['my-active-route-paradas'] })` y `getQueriesData({ queryKey: ['my-active-route-envios-hoja'] })` para obtener *todas* las variantes (incluyendo las que tienen `routeId`).
  - Iterar cada entry y aplicar el `filter` para remover el envío reprogramado.
  - Guardar snapshots por-key para rollback.
- En `onError`, restaurar **cada key** desde esos snapshots (igual al patrón ya usado en `DeliveryConfirmation.tsx`).

**Por qué esto lo arregla**
Porque ahora sí se actualizará el cache real que renderiza `ActiveRouteNavigation`, haciendo que la parada desaparezca inmediatamente.

### Cambio 2 — Hacer que la Ruta Activa ignore envíos desasignados (para que no reaparezcan ni bloqueen el “nextStop”)
**Archivo:** `src/pages/ActiveRouteNavigation.tsx`

**Qué voy a hacer**
1. En los selects anidados de `envios` voy a agregar `chofer_id`:
   - En la query de `hoja_ruta_envios -> envio: envios(...)`
   - En la query de `ruta_paradas -> envio: envios(...)`

2. En la construcción de la lista `envios` (la variable que se usa para stats, nextStop, lista, mapa), voy a filtrar para el chofer:
   - Mantener solo items donde `item.envio?.chofer_id === user.id`
   - Esto hace que un envío reprogramado (que queda con `chofer_id = NULL`) se elimine de la vista tras el refetch, y no vuelva a ser considerado “pendiente”.

**Por qué esto lo arregla**
- El backend, al reprogramar, desasigna el envío (`chofer_id = NULL`).
- La UI dejará de tratarlo como parada activa del chofer, así que:
  - No podrá quedar “pegado” como próxima parada.
  - No reaparecerá luego de invalidaciones/refetch.

## Alcance / impacto
- No requiere cambios de base de datos ni de funciones del backend para resolver el bloqueo de navegación.
- Es consistente con el comportamiento deseado: reprogramar = sacar ese envío del circuito del chofer.

## Pruebas que voy a realizar
1. En una ruta planificada “en curso”, reprogramar la parada #1:
   - Debe desaparecer inmediatamente de “Próxima entrega”.
   - Debe pasar a “Parada 2/N”.
2. Esperar el refetch/invalidación:
   - El envío reprogramado **no debe volver a aparecer** en la ruta del chofer.
3. Probar con otra parada (mitad de ruta) para confirmar que el filtro no rompe el orden.
4. Probar en modo hoja de ruta (si aplica) para confirmar que la lógica funciona en ambas rutas.

## (Opcional, recomendado) Hardening del RPC `reschedule_envio`
Noté que la condición de permisos en SQL usa `!=` con posibles NULLs; eso puede dejar “agujeros” lógicos cuando `chofer_id` está NULL. No es necesario para que el chofer avance, pero puedo proponerte luego un ajuste usando `IS DISTINCT FROM` para que el control de permisos sea explícito y no dependiente de NULL semantics.
