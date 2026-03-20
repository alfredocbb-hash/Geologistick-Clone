

## Plan: Fix zona matching para barrios de CABA/GBA en liquidaciones

### Problema encontrado

Los envíos ML de Lucas Galarza del 18/03/2026 tienen `precio_total = 0`, `precio_tarifa_vigente = 0` y `tarifa_id = null`. Son 9 de 11 envíos afectados.

La causa: el campo `ciudad_entrega` tiene barrios de CABA (Palermo, Núñez, Floresta, Villa Crespo, Santa Rita, Villa Real, etc.), pero la zona tarifa "Zona 3 - CABA Y GBA" lista "Capital Federal" y "CABA" como ciudades, no barrios individuales. El `findZoneTarifaPrecio` no encuentra match.

Sin embargo, el campo `provincia` de esos envíos sí dice "Capital Federal", que está en la lista de la zona.

### Solución

**`src/pages/DriverSettlements.tsx`** — Agregar un tercer nivel de fallback en `findZoneTarifaPrecio` y `findZoneTarifaComision`: si no hay match por `ciudad_entrega`, intentar match por `provincia`.

Cambios:
1. Modificar ambas funciones para recibir también `provincia` como segundo parametro.
2. Después del match por substring de ciudad, agregar match por `provincia` contra la lista de zonas.
3. Actualizar las llamadas para pasar `(envio as any).provincia` junto con `ciudad_entrega`.

Esto también afecta al `findZoneTarifaComision` para el caso de comision_tipo = 'tarifa' (aunque Lucas usa 'porcentaje', otros choferes podrían usar 'tarifa').

### Resultado esperado

Los 9 envíos de barrios CABA van a matchear contra la Zona 3 (precio_base = $8490), y la comisión de Lucas al 60% sería $5094 por envío en vez de $0.

| Archivo | Cambio |
|---------|--------|
| `src/pages/DriverSettlements.tsx` | Agregar fallback por `provincia` en `findZoneTarifaPrecio` y `findZoneTarifaComision` |

No se requiere migración de base de datos.

