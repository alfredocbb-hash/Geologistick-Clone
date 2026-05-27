## Objetivo

Corregir ENV-Q8FXT4: borrar todas las marcas de "entregado" del historial (27/03 y 27/04) y dejar el envío en estado `primera_visita` (incidencia ya registrada el 30/03: "No se pudo entregar ya que habia inconvenientes en el barrio...").

## Cambios

**1. Borrar filas de `envio_historial`** (4 filas):
- `c8f4f51e-...` (27/03 en_reparto→entregado)
- `df1d0064-...` (30/03 entregado→primera_visita, sin nota)
- `699eeb7e-...` (30/03 entregado→primera_visita, con nota de incidencia) — se conserva como nueva nota
- `d8bf6208-...` (21/04 primera_visita→en_reparto)
- `9e9aa433-...` (27/04 en_reparto→entregado)

Se mantienen las filas previas hasta `en_reparto` del 27/03 y se vuelve a insertar una entrada limpia: `en_reparto → primera_visita` con la nota original de la incidencia.

**2. Actualizar `envios`** (id `19d1aea9-5e04-47d7-96fa-0713b302c702`):
- `estado` = `primera_visita`
- `fecha_entrega` = NULL
- `entregado_en_sucursal` = false (ya está)
- `chofer_id` se mantiene (Kevin Bernard)

**3. Anular `pagos`** vinculados al envío si quedaron en estado cobrado/rendido por la marca de entregado (verificar y, si existen, marcar `anulado` con nota).

## Verificación

- Confirmar `estado = 'primera_visita'` y `fecha_entrega IS NULL`
- Confirmar historial limpio sin entradas "entregado"
- Confirmar que no hay pagos activos huérfanos

## Notas

Esta es una corrección puntual de datos. No se modifica código de aplicación. Se ejecuta vía `supabase--insert` (DELETE + UPDATE + INSERT del historial corregido).
