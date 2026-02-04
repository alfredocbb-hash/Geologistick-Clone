
# Plan: Caché de Segmentos + Mejoras Visuales del Recorrido

## Resumen

Implementaremos dos mejoras clave para la trazabilidad de choferes:

1. **Caché de Segmentos Procesados**: Almacenar rutas ya procesadas por Google Roads API para evitar llamadas repetidas y reducir costos/latencia
2. **Mejoras Visuales**: Marcadores de paradas intermedias, gradiente temporal en la línea, y estadísticas del recorrido

---

## Fase 1: Tabla de Caché para Segmentos Procesados

Se creará una nueva tabla para almacenar las rutas procesadas por Snap to Roads.

### Estructura de la Tabla

```text
┌────────────────────────────────────────────────────────────────┐
│  driver_route_segments                                         │
├────────────────────────────────────────────────────────────────┤
│  id              UUID (PK)                                     │
│  ruta_id         UUID (FK → rutas_planificadas)               │
│  chofer_id       UUID (FK → auth.users)                       │
│  tenant_id       UUID (FK → tenants)                          │
│  raw_points      JSONB  (puntos GPS originales)               │
│  snapped_points  JSONB  (puntos ajustados a calles)           │
│  points_hash     TEXT   (hash para detectar cambios)          │
│  created_at      TIMESTAMP                                     │
│  updated_at      TIMESTAMP                                     │
│  total_distance  NUMERIC (metros calculados)                  │
└────────────────────────────────────────────────────────────────┘
```

### Flujo de Funcionamiento

```text
┌─────────────────────────────────────────────────────────────────┐
│  SOLICITUD DE RECORRIDO                                         │
│                                                                 │
│  1. Cargar historial GPS de driver_location_history            │
│                          ↓                                      │
│  2. Calcular hash de los puntos (cantidad + coordenadas)       │
│                          ↓                                      │
│  3. ¿Existe caché con mismo hash?                              │
│       │                                                         │
│    SI ↓ NO                                                      │
│       │    │                                                    │
│       │    └──→ Llamar snap-to-roads API                       │
│       │              ↓                                          │
│       │         Guardar en driver_route_segments               │
│       │              ↓                                          │
│       └────────────────→ Retornar puntos snapped               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fase 2: Hook Mejorado con Caché

Modificaremos `useDriverRoute.ts` para:

- Verificar caché antes de llamar a la Edge Function
- Calcular hash de puntos para detectar si hay datos nuevos
- Guardar resultados procesados en la tabla de caché
- Calcular estadísticas adicionales (distancia total, velocidad promedio)

### Beneficios

| Sin Caché | Con Caché |
|-----------|-----------|
| Llamada API cada visualización | Llamada solo cuando hay datos nuevos |
| ~2-3s de procesamiento | <100ms desde base de datos |
| Costo por 1000 elementos | Costo reducido ~80-90% |

---

## Fase 3: Mejoras Visuales del Recorrido

### 3.1 Marcadores de Entregas Completadas

Se agregarán marcadores en los puntos donde el chofer realizó entregas durante la ruta.

```text
┌───────────────────────────────────────────────────────────────┐
│  MAPA CON PARADAS                                             │
│                                                               │
│     🟢 Inicio                                                 │
│       ╲                                                       │
│        ╲═══════╗                                              │
│                📦 Entrega #1 (10:30)                          │
│        ╔══════╝                                               │
│        ║                                                      │
│        📦 Entrega #2 (10:45)                                  │
│        ║                                                      │
│        ╚═══════╗                                              │
│                🚚 Posición actual                             │
└───────────────────────────────────────────────────────────────┘
```

### 3.2 Gradiente Temporal en Polyline

La línea del recorrido mostrará un degradado de color indicando progreso temporal:

- **Verde claro** → Inicio del recorrido
- **Verde oscuro** → Medio del recorrido  
- **Azul** → Reciente/actual

Esto se logra segmentando el polyline en tramos con colores progresivos.

### 3.3 Panel de Estadísticas Mejorado

Se agregará información calculada en tiempo real:

| Estadística | Descripción |
|-------------|-------------|
| Distancia total | Km recorridos |
| Tiempo en ruta | Duración desde inicio |
| Velocidad promedio | Km/h calculado |
| Paradas realizadas | Entregas completadas |
| % Ruta completada | Basado en envíos asignados |

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/` | Nueva tabla `driver_route_segments` |
| `src/hooks/useDriverRoute.ts` | Lógica de caché + hash + estadísticas |
| `src/components/maps/MapView.tsx` | Soporte para polyline con gradiente y marcadores de paradas |
| `src/pages/LiveMap.tsx` | Mostrar paradas en mapa + panel de estadísticas mejorado |

---

## Detalles Técnicos

### Cálculo de Hash para Caché

```text
hash = MD5(
  cantidad_puntos + 
  primer_punto.lat + primer_punto.lng +
  ultimo_punto.lat + ultimo_punto.lng
)
```

### Cálculo de Distancia (Haversine)

Se implementará una función que suma la distancia entre puntos consecutivos del polyline para obtener la distancia total en kilómetros.

### Polyline con Gradiente

Se divide el path en N segmentos (ej: 10), cada uno con un color diferente en una escala de verde a azul, creando efecto de degradado temporal.

---

## Consideraciones

- **RLS**: La tabla de caché tendrá políticas por tenant para seguridad multi-tenant
- **Limpieza automática**: Se puede agregar un trigger para eliminar caché de rutas finalizadas después de 30 días
- **Invalidación**: El caché se invalida automáticamente cuando hay nuevos puntos GPS (hash diferente)
- **Fallback**: Si el caché falla, el sistema funciona igual que antes (llamada directa a API)
