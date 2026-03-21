

## Plan: Corregir diferencia de precio entre API y NewShipment (COMPLETADO)

### Correcciones aplicadas

1. **`encontrarTarifaPorDestino` ahora retorna UNA sola tarifa** (la mejor coincidencia), igual que NewShipment. Si no hay match de destino → no devuelve tarifas (en vez de devolver todas).

2. **Filtro de conceptos por `es_basico`**: Solo se suman automáticamente al precio los conceptos con `es_basico = true` (o `null`/`undefined` como fallback). Los conceptos con `es_basico = false` se listan aparte como opcionales.

3. **Respuesta enriquecida**: Cada rate ahora incluye `conceptos_incluidos` y `conceptos_opcionales` para que Horizon pueda mostrarlos diferenciados.
