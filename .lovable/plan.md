

## Plan: Envíos reprogramados/incidencia en planificador + flujo "cliente ausente" → primera_visita

### Problema 1: Envíos con estado `reprogramado`, `primera_visita`, `segunda_visita` no aparecen en la lista principal del planificador

**Causa**: La query principal (línea 237) filtra solo `["pendiente", "recogido", "en_sucursal", "en_reparto"]` y requiere `chofer_id IS NULL`. Los envíos reprogramados ya tienen estado `pendiente` (el RPC `reschedule_envio` los resetea), pero si conservan `chofer_id` o tienen estado `primera_visita`/`segunda_visita`/`reprogramado`, no aparecen.

**Solución** en `src/pages/RoutePlanner.tsx`:
- Ampliar el filtro de estados a `["pendiente", "recogido", "en_sucursal", "en_reparto", "reprogramado", "primera_visita", "segunda_visita"]`
- Quitar el `.is("chofer_id", null)` estricto y reemplazarlo por un `.or("chofer_id.is.null,reprogramado_count.gt.0")` para que envíos reprogramados (que ya tuvieron chofer) sean visibles
- Misma lógica para la query de URL shipments (línea 260)

### Problema 2: "Cliente ausente" debería poner el envío en `primera_visita` (no `incidencia`)

**Flujo propuesto**: Cuando el chofer reporta "ausente" y tiene evidencia de que fue al domicilio (GPS o foto), el estado debería ser `primera_visita` en vez de `incidencia` genérica. Si ya está en `primera_visita`, debería pasar a `segunda_visita`.

**Solución** en `src/components/incidents/ReportIncidentDialog.tsx`:
- En la mutación (línea 207-211), si `incidentType === 'ausente'`:
  - Si `shipment.estado === 'en_reparto'` → cambiar a `primera_visita`
  - Si `shipment.estado === 'primera_visita'` → cambiar a `segunda_visita`
  - Cualquier otro caso → mantener `incidencia`
- Para otros tipos de incidente → mantener `incidencia` como está
- Actualizar el historial con el estado correcto

### Problema 3: Estos envíos deben verse en la solapa "Reprogramados" e "Incidencias"

La solapa "Reprogramados" (`RescheduledShipmentsList.tsx`) ya incluye `primera_visita` y `segunda_visita` en su query (línea 49), pero solo filtra por `reprogramado_count > 0`. Envíos con `primera_visita` que aún no fueron reprogramados no aparecen.

**Solución** en `src/components/routes/RescheduledShipmentsList.tsx`:
- Cambiar el filtro de `.gt('reprogramado_count', 0)` a un `.or()` que incluya también envíos con estado `primera_visita` o `segunda_visita` aunque no tengan `reprogramado_count > 0`
- Renombrar la solapa a "Reprogramados / Visitas" para claridad

### Resumen de archivos a modificar

1. **`src/pages/RoutePlanner.tsx`** — Ampliar filtro de estados + relajar filtro `chofer_id` para reprogramados
2. **`src/components/incidents/ReportIncidentDialog.tsx`** — "ausente" → `primera_visita` / `segunda_visita` según estado actual
3. **`src/components/routes/RescheduledShipmentsList.tsx`** — Incluir envíos en `primera_visita`/`segunda_visita` sin `reprogramado_count`

