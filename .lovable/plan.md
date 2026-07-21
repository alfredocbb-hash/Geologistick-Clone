## Causa

En `src/pages/Incidents.tsx` (query `incidents-canceladas`, línea ~144) se traen todos los envíos del tenant con `estado ∈ ('cancelado','devuelto')`, sin importar si el paquete llegó a salir a reparto. Por eso aparecen también cancelaciones tempranas (p. ej. pedidos anulados en `pendiente` / `en_sucursal`).

## Cambio

Filtrar la lista de "Canceladas / Devoluciones" para que sólo incluya envíos que en algún momento pasaron por `en_reparto`.

Pasos:

1. En esa query, después de traer los envíos cancelados/devueltos, consultar `envio_historial` con `estado_nuevo = 'en_reparto'` para ese conjunto de `envio_ids` (una sola query, sin N+1).
2. Construir un `Set<envio_id>` de los que tuvieron al menos un evento `en_reparto`.
3. Filtrar `envios` por ese set antes de mapear el resultado final. El resto del pipeline (historial de cierre, incidencias, perfiles) queda igual, sólo opera sobre el subconjunto filtrado.
4. El KPI "Canceladas / Devoluciones" y el badge del tab usan `canceladas?.length`, así que quedan automáticamente alineados.

No se toca la pestaña de Tracking ni la lógica de `ReturnToSenderDialog`; el filtro es sólo de visualización en Incidencias.

## Nota

- No aplica a envíos importados desde ML donde el estado interno saltó directo a `cancelado` sin registrar `en_reparto` en `envio_historial`; ésos quedarán fuera (que es lo pedido).
- Si más adelante querés incluir también `primera_visita` / `segunda_visita` como "salió a reparto", se extiende el filtro sumando esos estados al `in()`.