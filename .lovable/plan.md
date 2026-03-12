

# Fix: Liquidación de sucursal no encuentra envíos recepcionados por filtro de fecha

## Diagnóstico

El envío `ENV-RFVNU8` tiene:
- `created_at`: 9 de marzo (creado en Rosario)
- `fecha_entrega`: 12 de marzo (entregado por Mar del Plata)
- `sucursal_entrega_id`: Mar del Plata
- `sucursal_origen_id`: Rosario
- `sucursal_destino_id`: NULL

Mar del Plata tiene `tipo_liquidacion = 'inmediata'`, lo que hace que la query filtre por `created_at`. El envío se creó el 9 de marzo en Rosario, así que cuando Mar del Plata busca liquidar por fechas recientes, no lo encuentra porque `created_at` refleja cuándo se creó en el origen, no cuándo Mar del Plata lo recibió/entregó.

## Solución

### `src/pages/BranchSettlements.tsx`

Implementar una **estrategia de consulta dual** (similar a la que ya usa DriverSettlements): ejecutar dos queries y deduplicar resultados.

1. **Query 1 (origen)**: Buscar envíos donde `sucursal_origen_id = selectedSucursal`, filtrados por el campo de fecha según `tipo_liquidacion` (`created_at` para inmediata, `fecha_entrega` para diferida).

2. **Query 2 (recepción)**: Buscar envíos donde `sucursal_destino_id = selectedSucursal` OR `sucursal_entrega_id = selectedSucursal`, filtrados **siempre por `fecha_entrega`** (la fecha relevante para la sucursal que recibió/entregó).

3. **Deduplicación**: Unir resultados por `id` para evitar duplicados.

Esto asegura que envíos originados en otra sucursal pero recibidos/entregados por la sucursal seleccionada aparezcan al liquidar, usando la fecha en que efectivamente fueron entregados.

### Cambio concreto (líneas ~177-199)

```typescript
// Query 1: Envíos donde la sucursal es ORIGEN (fecha según tipo_liquidacion)
const dateFieldOrigen = sucursalConfig?.tipo_liquidacion === 'inmediata' ? 'created_at' : 'fecha_entrega';

const { data: enviosOrigen, error: origenError } = await supabase
  .from('envios')
  .select(`id, tracking_number, precio_total, tipo_pago, created_at, estado, sucursal_origen_id, sucursal_destino_id, sucursal_entrega_id, envio_detalles(concepto_id, monto, nombre_concepto)`)
  .eq('sucursal_origen_id', selectedSucursal)
  .gte(dateFieldOrigen, toLocalISOStart(fechaInicio))
  .lte(dateFieldOrigen, toLocalISOEnd(fechaFin))
  .in('estado', ['entregado', 'devuelto']);

if (origenError) throw origenError;

// Query 2: Envíos recibidos/entregados por la sucursal (siempre por fecha_entrega)
const { data: enviosRecepcion, error: recepcionErr } = await supabase
  .from('envios')
  .select(`id, tracking_number, precio_total, tipo_pago, created_at, estado, sucursal_origen_id, sucursal_destino_id, sucursal_entrega_id, envio_detalles(concepto_id, monto, nombre_concepto)`)
  .or(`sucursal_destino_id.eq.${selectedSucursal},sucursal_entrega_id.eq.${selectedSucursal}`)
  .neq('sucursal_origen_id', selectedSucursal) // Evitar duplicados con query 1
  .gte('fecha_entrega', toLocalISOStart(fechaInicio))
  .lte('fecha_entrega', toLocalISOEnd(fechaFin))
  .in('estado', ['entregado', 'devuelto']);

if (recepcionErr) throw recepcionErr;

// Deduplicar por ID
const enviosMap = new Map();
[...(enviosOrigen || []), ...(enviosRecepcion || [])].forEach(e => {
  if (!enviosMap.has(e.id)) enviosMap.set(e.id, e);
});
const envios = Array.from(enviosMap.values());
```

### Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/BranchSettlements.tsx` | Reemplazar query única por consulta dual con deduplicación |

