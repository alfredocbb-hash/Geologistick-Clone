
# Plan: Filtrar Paradas de Entrega por Ruta Específica

## Problema Identificado

Al hacer clic en "Ver último recorrido" en el Mapa en Vivo, el sistema muestra **todas las entregas históricas** del chofer en lugar de solo las entregas de la ruta seleccionada.

### Datos del Problema
- Kevin Bernard tiene **117 envíos entregados** con coordenadas GPS en total
- La ruta específica `RP-20260204-6391` tiene solo **5 paradas**
- El mapa está mostrando 17+ marcadores cuando debería mostrar solo los de esa ruta

### Causa Raíz
En `src/hooks/useDriverRoute.ts`, líneas 169-177, cuando se carga una ruta por `ruta_id`:

```typescript
// Código actual - INCORRECTO
deliveriesQuery = await supabase
  .from('envios')
  .select('tracking_number, entrega_lat, entrega_lng, fecha_entrega')
  .eq('chofer_id', driverId)     // ← Solo filtra por chofer
  .eq('estado', 'entregado')      // ← NO filtra por ruta_id!
  ...
```

Esto obtiene **todos los envíos entregados** del chofer, no solo los de la ruta actual.

---

## Solución Propuesta

### Archivo: `src/hooks/useDriverRoute.ts`

Modificar la consulta de delivery stops para filtrar usando la tabla `ruta_paradas` (que vincula rutas con envíos):

### Código Corregido

```typescript
// ANTES (líneas 168-178) - Obtiene TODOS los envíos del chofer
} else {
  deliveriesQuery = await supabase
    .from('envios')
    .select('tracking_number, entrega_lat, entrega_lng, fecha_entrega')
    .eq('chofer_id', driverId)
    .eq('estado', 'entregado')
    ...
}
```

```typescript
// DESPUÉS - Filtrar envíos por ruta específica usando ruta_paradas
} else {
  // Primero obtener los envio_id de la ruta específica
  const { data: rutaParadas } = await supabase
    .from('ruta_paradas')
    .select('envio_id')
    .eq('ruta_id', identifier.rutaId);
  
  const envioIds = rutaParadas?.map(p => p.envio_id).filter(Boolean) || [];
  
  if (envioIds.length > 0) {
    deliveriesQuery = await supabase
      .from('envios')
      .select('tracking_number, entrega_lat, entrega_lng, fecha_entrega')
      .in('id', envioIds)  // ← Filtrar por envíos de esta ruta
      .eq('estado', 'entregado')
      .not('entrega_lat', 'is', null)
      .not('entrega_lng', 'is', null)
      .not('fecha_entrega', 'is', null)
      .order('fecha_entrega', { ascending: true });
  }
}
```

---

## Flujo de Datos Corregido

```text
┌─────────────────────────────────────────────────────────────────┐
│  Usuario hace clic en "Ver último recorrido" de Kevin          │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│  loadRoute(chofer_id: 'kevin', ruta_id: 'RP-6391')             │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│  1. Obtener historial GPS de driver_location_history           │
│     WHERE chofer_id = 'kevin' AND ruta_id = 'RP-6391'          │
│     ✓ Correcto - ya filtra por ruta_id                         │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. Obtener paradas de entrega:                                │
│                                                                 │
│  ANTES: envios WHERE chofer_id = 'kevin' → 117 resultados     │
│                                                                 │
│  DESPUÉS: ruta_paradas WHERE ruta_id = 'RP-6391' → 5 envio_id │
│           envios WHERE id IN (5 ids) → 5 resultados           │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│  Mapa muestra: polyline GPS + 5 marcadores de entrega          │
│  (en lugar de 17+ marcadores de todas las entregas históricas) │
└─────────────────────────────────────────────────────────────────┘
```

---

## Resultado Visual Esperado

### Antes (Problema)
El mapa muestra marcadores 1-17 dispersos por toda el área, incluyendo entregas de rutas anteriores.

### Después (Correcto)
El mapa muestra solo los marcadores de las 5 paradas que pertenecen a la ruta seleccionada, alineados con la polilínea del recorrido GPS.

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/hooks/useDriverRoute.ts` | Filtrar delivery stops por ruta_id usando la tabla ruta_paradas (líneas ~168-178) |

---

## Impacto

1. **Visualización correcta**: Solo se muestran las paradas de la ruta seleccionada
2. **Consistencia**: La polilínea GPS y los marcadores de entrega corresponden a la misma ruta
3. **Mejor auditoría**: Los administradores pueden verificar qué entregas se realizaron en cada ruta específica
