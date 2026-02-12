
# Fix: Liquidacion a Choferes no trae resultados por desfase de zona horaria

## Problema

Las entregas realizadas a la noche (despues de las 21hs Argentina) quedan grabadas con fecha UTC del dia siguiente. Por ejemplo:

| Fecha local (Argentina) | Fecha UTC (en la base) |
|---|---|
| 11/02 a las 22:01 | 12/02 a las 01:01 |

Cuando se buscan entregas del 11/02, el filtro compara contra UTC sin ajustar, asi que las entregas de la noche no aparecen. Si todas las entregas del chofer fueron a la noche, el resultado es 0 envios.

## Solucion

Agregar el offset de zona horaria del navegador a los filtros de fecha. En lugar de enviar `'2026-02-11'` y `'2026-02-11T23:59:59'` (que Postgres interpreta como UTC), enviar `'2026-02-11T00:00:00-03:00'` y `'2026-02-11T23:59:59-03:00'`. Postgres convierte automaticamente y compara correctamente.

## Cambio

| Archivo | Cambio |
|---------|--------|
| `src/pages/DriverSettlements.tsx` | Ajustar los filtros `.gte()` y `.lte()` de `fecha_entrega` para incluir el offset de la zona horaria local |

## Detalle tecnico

Crear una funcion helper que tome una fecha tipo `YYYY-MM-DD` y le agregue el offset local del navegador:

```typescript
function toLocalISOStart(dateStr: string): string {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const mins = String(Math.abs(offset) % 60).padStart(2, '0');
  return `${dateStr}T00:00:00${sign}${hours}:${mins}`;
}

function toLocalISOEnd(dateStr: string): string {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const mins = String(Math.abs(offset) % 60).padStart(2, '0');
  return `${dateStr}T23:59:59${sign}${hours}:${mins}`;
}
```

Luego en `calculateMutation` cambiar:

```typescript
// Antes
.gte('fecha_entrega', fechaInicio)
.lte('fecha_entrega', fechaFin + 'T23:59:59')

// Despues
.gte('fecha_entrega', toLocalISOStart(fechaInicio))
.lte('fecha_entrega', toLocalISOEnd(fechaFin))
```

Ejemplo con Argentina (UTC-3):
- Antes: `>= '2026-02-11'` y `<= '2026-02-11T23:59:59'` (UTC)
- Despues: `>= '2026-02-11T00:00:00-03:00'` y `<= '2026-02-11T23:59:59-03:00'`

Postgres convierte `2026-02-11T00:00:00-03:00` a `2026-02-11T03:00:00Z`, capturando correctamente las entregas de la noche del 11.

## Alcance adicional

Este mismo problema afecta otros modulos que filtran timestamps por fecha. Se recomienda aplicar la misma correccion en:

- `src/pages/DriverSettlements.tsx` (este fix)
- `src/pages/MyCommissions.tsx` (filtros de comisiones del chofer)

Los demas modulos de liquidaciones (sucursales, clientes, terceros) usan campos `date` o `periodo_inicio`/`periodo_fin` que no tienen este problema.

## Resultado esperado

Al seleccionar un chofer y las fechas, se traen correctamente los envios entregados en esas fechas segun la hora local, sin importar que en UTC caigan en el dia siguiente.
