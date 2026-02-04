
# Plan: Historial de Recorridos GPS para Rutas Planificadas

## Resumen

Agregaremos la funcionalidad de visualizar el recorrido GPS de los choferes para las rutas planificadas, incluyendo filtros por fecha, de forma similar a como se implementó en las Hojas de Ruta.

## Estado Actual

| Componente | Estado |
|------------|--------|
| Hojas de Ruta (RouteSheets.tsx) | Ya implementado con filtros de fecha y visualización GPS |
| Rutas Planificadas (RoutePlanner.tsx) | Solo muestra rutas activas, sin historial ni GPS |
| Hook useDriverRoute | Ya soporta `loadRoute(driverId, rutaId)` para rutas planificadas |
| Datos GPS | Existen registros en `driver_location_history` con `ruta_id` |

## Cambios Propuestos

### 1. Nueva Pestaña "Historial" en el Planificador

Agregar una nueva pestaña junto a las existentes (Crear, Frecuentes, Terciarizados, Reprogramados, Activas):

```text
[Crear Ruta] [Frecuentes] [Terciarizados] [Reprogramados] [Activas] [Historial]
```

### 2. Contenido de la Pestaña Historial

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Historial de Rutas                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  [🔍 Buscar...]   [📅 Desde: __/__]   [📅 Hasta: __/__]   [X Limpiar]      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │  RP-20260204-1751                                [Completada] │          │
│  │  👤 Kevin Bernard                    📍 5/5 paradas           │          │
│  │  📅 04/02/2026                       🚗 12.5 km               │          │
│  │  [📋 Imprimir]                  [🗺️ Ver Recorrido] (si GPS)  │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │  RP-20260204-6391                                [Completada] │          │
│  │  👤 Kevin Bernard                    📍 3/3 paradas           │          │
│  │  📅 04/02/2026                       🚗 8.2 km                │          │
│  │  [📋 Imprimir]                  [🗺️ Ver Recorrido] (si GPS)  │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3. Dialog de Visualización del Recorrido

Al hacer clic en "Ver Recorrido", se mostrará el mismo dialog que en RouteSheets:

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  Recorrido de Kevin Bernard - RP-20260204-1751                    [X]   │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                                                                    │ │
│  │                    [MAPA CON RECORRIDO]                            │ │
│  │                    Polyline con degradado temporal                 │ │
│  │                    Marcadores de entregas completadas              │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  📏 12.5 km  │  ⏱️ 1h 23m  │  🚗 28 km/h  │  📦 5 entregas        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Detalles Tecnicos

### Archivo a Modificar: `src/pages/RoutePlanner.tsx`

**Nuevos Imports:**
- `Popover`, `PopoverContent`, `PopoverTrigger` de shadcn
- `Calendar` de shadcn
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` de shadcn
- `useDriverRoute` hook
- `GoogleMapsProvider`, `MapView`, `RouteStatsPanel` de maps

**Nuevos Estados:**
```text
- historyDateFrom: Date | undefined
- historyDateTo: Date | undefined
- showHistoryRouteDialog: boolean
- selectedHistoryRoute: RutaPlanificada | null
```

**Nueva Query: Rutas Históricas**
```text
SELECT 
  rp.*,
  p.nombre, p.apellido,
  (SELECT COUNT(*) FROM driver_location_history WHERE ruta_id = rp.id) > 0 AS has_gps_history
FROM rutas_planificadas rp
LEFT JOIN profiles p ON p.user_id = rp.chofer_id
WHERE rp.estado = 'completada'
  AND rp.created_at >= dateFrom
  AND rp.created_at <= dateTo
ORDER BY rp.created_at DESC
```

**Integración con useDriverRoute:**
```text
// Al hacer clic en "Ver Recorrido"
const handleViewHistoryRoute = async (ruta: RutaPlanificada) => {
  setSelectedHistoryRoute(ruta);
  setShowHistoryRouteDialog(true);
  await driverRoute.loadRoute(ruta.chofer_id, ruta.id);
};
```

### Flujo de Datos

```text
1. Usuario navega a pestaña "Historial"
   ↓
2. Se cargan rutas con estado "completada" (filtradas por fecha si aplica)
   ↓
3. Query verifica cuáles tienen historial GPS
   ↓
4. Tarjetas muestran botón "Ver Recorrido" si hay GPS
   ↓
5. Usuario hace clic en "Ver Recorrido"
   ↓
6. driverRoute.loadRoute(chofer_id, ruta_id)
   ↓
7. Dialog muestra mapa con recorrido + estadísticas
```

### Componentes a Reutilizar

| Componente | Uso |
|------------|-----|
| `Calendar` | Selectores de fecha en filtros |
| `Popover` | Contenedor de calendarios |
| `GoogleMapsProvider` | Wrapper para mapa |
| `MapView` | Renderizado del mapa con polyline |
| `RouteStatsPanel` | Panel de estadísticas del recorrido |
| `useDriverRoute` | Hook para cargar datos GPS |

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/RoutePlanner.tsx` | Nueva pestaña "Historial", filtros de fecha, dialog de recorrido |

---

## Resultado Esperado

1. Nueva pestaña "Historial" en el Planificador de Rutas
2. Listado de rutas completadas con filtro por fecha
3. Cada tarjeta muestra chofer, fecha, distancia y paradas
4. Botón "Ver Recorrido" visible cuando hay historial GPS
5. Dialog con mapa calle por calle y estadísticas
6. Funciona con el cache existente de `driver_route_segments`
