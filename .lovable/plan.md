
# Plan: Hojas de Ruta con Recorrido de Choferes y Filtro por Fecha

## Resumen

Agregaremos la funcionalidad para ver las hojas de ruta con el recorrido GPS del chofer, incluyendo filtros por rango de fechas.

## Cambios Propuestos

### 1. Agregar Filtros de Fecha

Se agregarán dos selectores de fecha (Desde/Hasta) en la barra de filtros existente para limitar las hojas de ruta mostradas.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  [🔍 Buscar...]   [📅 Desde: 01/02/26]  [📅 Hasta: 04/02/26]  [Limpiar] │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2. Agregar Datos del Chofer en cada Tarjeta

Cada tarjeta de hoja de ruta mostrará:
- Nombre del chofer asignado (si existe)
- Indicador de si tiene historial GPS disponible
- Botón "Ver Recorrido" cuando hay datos de ubicación

```text
┌─────────────────────────────────────────┐
│  HR-20260204-6599          [Recibida]  │
├─────────────────────────────────────────┤
│  📍 Sucursal A → Sucursal B            │
│  🚛 Kevin Bernard                       │
│  📦 5 envíos    🕐 04/02 17:02         │
├─────────────────────────────────────────┤
│  [Imprimir]  [QR]  [🗺️ Ver Recorrido] │
└─────────────────────────────────────────┘
```

### 3. Dialog de Visualización del Recorrido

Al hacer clic en "Ver Recorrido", se abrirá un dialog que muestra:
- Mapa con el recorrido trazado calle por calle (usando Snap to Roads)
- Degradado de color verde a azul mostrando progresión temporal
- Marcadores de entregas completadas
- Panel de estadísticas: distancia, tiempo, velocidad promedio, paradas

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Recorrido de Kevin Bernard - HR-20260120-3006               [X]    │
├──────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │                    [MAPA CON RECORRIDO]                        │ │
│  │                    Polyline con degradado                      │ │
│  │                    Marcadores de entregas                      │ │
│  │                                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  📏 12.5 km  │  ⏱️ 1h 23m  │  🚗 28 km/h  │  📦 5 entregas    │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Detalles Tecnicos

### Archivo a Modificar: `src/pages/RouteSheets.tsx`

**Nuevos Estados:**
- `dateFrom: Date | undefined` - Fecha inicio del filtro
- `dateTo: Date | undefined` - Fecha fin del filtro  
- `selectedHojaRuta: HojaRuta | null` - Hoja de ruta seleccionada para ver recorrido
- `showRouteDialog: boolean` - Control del dialog de recorrido

**Modificaciones a la Query de Hojas de Ruta:**
- Agregar join con `profiles` para obtener nombre del chofer
- Agregar filtro por rango de fechas usando `gte` y `lte` en `created_at`
- Verificar si existe historial GPS en `driver_location_history` para cada hoja

**Nueva Query: Verificar Historial GPS**
```text
SELECT hoja_ruta_id, COUNT(*) as puntos
FROM driver_location_history
WHERE hoja_ruta_id IN (ids de hojas visibles)
GROUP BY hoja_ruta_id
```

**Hook Existente a Reutilizar:**
- `useDriverRoute` - Ya implementado, carga el historial GPS y procesa con Snap to Roads

**Componentes Existentes a Reutilizar:**
- `MapView` con props `polylinePath`, `useGradient`, `deliveryStops`
- `RouteStatsPanel` para mostrar estadisticas del recorrido
- `Calendar` de shadcn/ui para selectores de fecha
- `Popover` para los date pickers
- `Dialog` para el modal del recorrido

### Flujo de Datos

```text
1. Usuario selecciona rango de fechas
   ↓
2. Query filtra hojas_ruta por created_at BETWEEN dateFrom AND dateTo
   ↓
3. Se hace join con profiles para obtener nombre del chofer
   ↓
4. Query secundaria verifica cuales hojas tienen historial GPS
   ↓
5. Tarjetas muestran boton "Ver Recorrido" si hay historial
   ↓
6. Usuario hace clic en "Ver Recorrido"
   ↓
7. useDriverRoute.loadRoute(chofer_id, hoja_ruta_id) usando hoja_ruta_id
   ↓
8. Dialog muestra mapa con recorrido + estadisticas
```

### Modificacion del Hook useDriverRoute

Actualmente el hook busca por `ruta_id`. Necesitamos agregar soporte para buscar por `hoja_ruta_id`:

```text
// Nueva funcion en el hook
loadRouteByHojaRuta(driverId: string, hojaRutaId: string)
  - Consulta driver_location_history WHERE hoja_ruta_id = hojaRutaId
  - Resto del proceso igual (snap to roads, cache, etc)
```

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/RouteSheets.tsx` | Filtros de fecha, datos del chofer, dialog de recorrido |
| `src/hooks/useDriverRoute.ts` | Agregar `loadRouteByHojaRuta` para buscar por hoja_ruta_id |

---

## Resultado Esperado

1. Usuario puede filtrar hojas de ruta por rango de fechas
2. Cada tarjeta muestra el chofer asignado
3. Boton "Ver Recorrido" visible cuando hay historial GPS
4. Dialog muestra recorrido calle por calle con estadisticas
5. Funciona con el cache existente de `driver_route_segments`
