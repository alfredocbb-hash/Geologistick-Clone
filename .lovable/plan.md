# Sacar envíos con visita fallida de la "Sugerida" sin eliminarlos

## Contexto
Hoy, al reportar incidente "Cliente ausente", el envío pasa a `primera_visita` (o `segunda_visita`). El sistema sigue marcándolo como próxima parada sugerida, lo que hace que el chofer vuelva a verlo de inmediato.

## Cambio

### `src/pages/ActiveRouteNavigation.tsx` — `nextStop` (memo)
Agregar `primera_visita` y `segunda_visita` a los estados que se saltan al elegir la próxima parada:

```ts
if (envio.estado === 'incidencia') return false;
if (envio.estado === 'primera_visita' || envio.estado === 'segunda_visita') return false;
```

Y en `mapMarkers`, marcar esos estados como "completados" visualmente para que no aparezcan como `current`:

```ts
const isCompleted =
  envio.estado === 'entregado' ||
  envio.estado === 'devuelto' ||
  envio.estado === 'incidencia' ||
  envio.estado === 'primera_visita' ||
  envio.estado === 'segunda_visita' ||
  envio.estado_retiro === 'retirado';
```

## Resultado
- El envío en `primera_visita`/`segunda_visita` queda fuera de la sugerencia y del foco del mapa.
- Sigue listado en la ruta y se puede tocar para reintentar la entrega (el flujo de entrega ya existente acepta esos estados).
- El próximo destino sugerido pasa al siguiente envío pendiente.

No requiere cambios en BD ni en el dialog de incidentes (la transición a `primera_visita` ya funciona).
