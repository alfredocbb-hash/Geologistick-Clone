# Sincronizar subestados ML con estados internos

## Problema

ML reporta `status=shipped` + `substatus=receiver_absent` ("Destinatario ausente"), pero `ml_status_mapping` solo tiene `receiver_absent` bajo `status=not_delivered`. Sin mapping aplicable, el envío queda en `en_reparto` y el operador no ve el subestado real.

## Cambios

### 1. Mappings nuevos en `ml_status_mapping`

Agregar combinaciones `shipped + <substatus>` faltantes:

| ml_status | ml_substatus           | estado_interno   |
|-----------|------------------------|------------------|
| shipped   | receiver_absent        | primera_visita * |
| shipped   | returning_to_hub       | en_transito      |
| shipped   | returning_to_sender    | devuelto         |
| shipped   | buyer_refused          | no_entregado     |
| shipped   | damaged                | incidencia       |
| shipped   | stolen                 | incidencia       |
| shipped   | lost                   | incidencia       |
| shipped   | waiting_for_withdrawal | en_sucursal      |
| shipped   | in_hub                 | en_sucursal      |

\* `receiver_absent` se resuelve dinámicamente (ver paso 2).

### 2. Conteo de visitas (primera / segunda)

En `mercadolibre-sync` y `mercadolibre-webhook`, al detectar `substatus IN ('receiver_absent','second_visit')`:

- Leer el estado actual del envío.
- Si `estado` ∈ {`en_reparto`,`en_transito`,`en_sucursal`,`recogido`} y `reprogramado_count = 0` y nunca pasó por `primera_visita` → marcar **`primera_visita`** e incrementar contador.
- Si ya estuvo en `primera_visita` (o `reprogramado_count >= 1`, o el substatus es explícitamente `second_visit`) → marcar **`segunda_visita`**.
- Verificación rápida del historial vía `envio_historial` (`SELECT 1 FROM envio_historial WHERE envio_id=$1 AND estado_nuevo='primera_visita' LIMIT 1`).

Esto reemplaza al mapping estático para `receiver_absent` (el mapping sirve como fallback si la consulta falla).

### 3. Override controlado del anti-downgrade

Hoy un envío en `en_reparto` (rank 4) no puede pasar a `en_transito`/`en_sucursal` (rank 2-3). Agregar set `FORCE_OVERRIDE_SUBSTATUS = {returning_to_hub, returning_to_sender, waiting_for_withdrawal, in_hub}`: si el substatus está en el set, se aplica el mapping aunque baje el rank. Estados finales (`entregado`/`cancelado`/`devuelto`/`no_entregado`) siguen bloqueados salvo super_admin.

### 4. Resincronización de envíos existentes

`UPDATE envios SET estado=<correcto>` para cada envío con `ml_substatus_actual` en la lista, respetando la lógica de visitas y registrando entrada en `envio_historial` con nota "Resincronización subestados ML".

Tablas afectadas:
- `receiver_absent` + `en_reparto`/`en_transito`/`en_sucursal` → `primera_visita` (o `segunda_visita` si ya tuvo una visita previa)
- `returning_to_hub` → `en_transito`
- `returning_to_sender` → `devuelto`
- `waiting_for_withdrawal`/`in_hub` → `en_sucursal`
- `buyer_refused` → `no_entregado`
- `damaged`/`stolen`/`lost` → `incidencia`

### 5. Badge inline en la columna "Estado"

En la tabla de envíos (`src/components/shipments/ShipmentsTable.tsx` o equivalente), cuando `isNoteworthyMLSubstatus(env.ml_substatus_actual)` sea true, mostrar debajo del badge de estado interno un mini-badge con `getMLSubstatusLabel(...)` (ej. "Destinatario ausente"). Usa los helpers ya existentes en `src/lib/mlSubstatusLabels.ts`.

## Archivos

- **Migración 1**: `INSERT ... ON CONFLICT DO NOTHING` en `ml_status_mapping` (9 filas).
- **Migración 2**: `UPDATE` de resincronización + inserts en `envio_historial`.
- **Edge function** `supabase/functions/mercadolibre-sync/index.ts`: lógica de visitas + override.
- **Edge function** `supabase/functions/mercadolibre-webhook/index.ts`: mismas dos lógicas.
- **Frontend**: localizar la tabla de envíos y añadir el badge inline.

## Riesgos

- Si un envío legítimamente está en `en_transito` por otro motivo y llega `receiver_absent` viejo en cache de ML, podría marcarse como visita. Mitigado por el chequeo de `reprogramado_count` y por consultar historial.
- La resincronización es una operación masiva: la ejecuto envío por envío dentro de un solo statement con CTE para que sea atómico y cuente filas afectadas.
