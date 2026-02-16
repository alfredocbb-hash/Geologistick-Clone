

# Corregir fecha_entrega de envios ML y mejorar query de liquidacion

## Problema encontrado

El fix anterior (`SET fecha_entrega = updated_at`) asigno fechas incorrectas. Los 11 envios ML de Lucas del 13/02 recibieron `fecha_entrega` del 14/02 o 16/02 porque `updated_at` habia sido modificado por otros procesos posteriores a la entrega. Por eso ahora solo aparecen 8 envios en lugar de 17.

Datos actuales:
- Ruta del 13/02 tiene 14 paradas (envios) + 3 de otra ruta = 17 total
- Solo 8 tienen `fecha_entrega` el 13/02
- 9 tienen `fecha_entrega` el 14/02 o 16/02 (incorrecta, puesta por el UPDATE anterior)

## Solucion en 2 partes

### Parte 1: Corregir datos - SQL

Actualizar los envios que estan en rutas del 13/02 pero tienen fecha_entrega incorrecta. Usar la fecha de la ruta como referencia real:

```sql
UPDATE envios e
SET fecha_entrega = (r.fecha::date + interval '15 hours')
FROM ruta_paradas rp
JOIN rutas_planificadas r ON r.id = rp.ruta_id
WHERE rp.envio_id = e.id
AND e.estado = 'entregado'
AND r.fecha = '2026-02-13'
AND r.chofer_id = '6a9645ab-78d2-4eeb-a94b-b92b8708a515'
AND e.fecha_entrega::date != '2026-02-13';
```

Ademas, correccion general para TODOS los envios del sistema que esten en la misma situacion (entregados con fecha_entrega que no coincide con su ruta):

```sql
UPDATE envios e
SET fecha_entrega = (r.fecha::date + interval '15 hours')
FROM ruta_paradas rp
JOIN rutas_planificadas r ON r.id = rp.ruta_id
WHERE rp.envio_id = e.id
AND e.estado = 'entregado'
AND e.fecha_entrega::date != r.fecha
AND r.estado = 'completada';
```

### Parte 2: Mejorar query de liquidacion (`src/pages/DriverSettlements.tsx`)

Hacer la query mas robusta: ademas de buscar por `fecha_entrega`, tambien buscar envios que esten en rutas del periodo seleccionado. Esto cubre el caso donde `fecha_entrega` no coincide con la fecha real de entrega.

**Cambio en lineas 209-220:**

Agregar una segunda query que busque envios entregados asignados a rutas del chofer en el rango de fechas, y combinar ambos resultados sin duplicados:

```typescript
// Query 1: por fecha_entrega (actual)
const { data: enviosByFecha } = await supabase
  .from('envios')
  .select(...)
  .eq('estado', 'entregado')
  .or(`chofer_id.eq.${chofer.user_id},chofer_ultima_milla_id.eq.${chofer.user_id}`)
  .gte('fecha_entrega', toLocalISOStart(fechaInicio))
  .lte('fecha_entrega', toLocalISOEnd(fechaFin));

// Query 2: por fecha de ruta
const { data: rutasDelPeriodo } = await supabase
  .from('rutas_planificadas')
  .select('id')
  .eq('chofer_id', chofer.user_id)
  .gte('fecha', fechaInicio)
  .lte('fecha', fechaFin);

// Si hay rutas, obtener sus envios entregados
let enviosByRuta = [];
if (rutasDelPeriodo?.length) {
  const rutaIds = rutasDelPeriodo.map(r => r.id);
  const { data: paradas } = await supabase
    .from('ruta_paradas')
    .select('envio_id')
    .in('ruta_id', rutaIds);
  
  if (paradas?.length) {
    const envioIds = paradas.map(p => p.envio_id);
    const { data } = await supabase
      .from('envios')
      .select(/* same fields */)
      .eq('estado', 'entregado')
      .in('id', envioIds);
    enviosByRuta = data || [];
  }
}

// Combinar sin duplicados
const allEnvioIds = new Set();
const envios = [];
for (const e of [...(enviosByFecha || []), ...enviosByRuta]) {
  if (!allEnvioIds.has(e.id)) {
    allEnvioIds.add(e.id);
    envios.push(e);
  }
}
```

## Resumen

1. **Migracion SQL**: Corregir `fecha_entrega` usando la fecha de ruta como fuente real
2. **Codigo**: Query dual (fecha_entrega + fecha de ruta) para que siempre se encuentren todos los envios del chofer en el periodo, sin importar inconsistencias en `fecha_entrega`

