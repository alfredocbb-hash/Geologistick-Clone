
# Plan: Trazabilidad Calle por Calle en Mapa en Vivo

## Estado: ✅ IMPLEMENTADO

Ya existe una implementación base que incluye:
- Edge Function `snap-to-roads` que utiliza Google Roads API
- Diálogo de "Ver recorrido" que aplica Snap to Roads
- Polylines con estilo de navegación (sombra azul + flechas)
- Historial de ubicaciones guardándose cada 30 segundos

Sin embargo, hay oportunidades de mejora significativas para lograr la trazabilidad idéntica a la imagen de QuadMinds.

---

## Mejoras Propuestas

### 1. Visualización del Recorrido en la Vista Principal

Actualmente el recorrido solo se muestra al abrir un diálogo. La mejora añadirá:
- Opción de ver el recorrido directamente en el mapa principal
- Click en un chofer para mostrar/ocultar su trayecto
- Polyline persistente mientras el chofer esté seleccionado

```text
┌─────────────────────────────────────────────────────────┐
│  MAPA PRINCIPAL                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │                                                   │ │
│  │     🟢 Inicio                                    │ │
│  │       ╲                                          │ │
│  │        ╲═══════╗                                 │ │
│  │                ║                                 │ │
│  │        ╔══════╝                                  │ │
│  │        ║                                         │ │
│  │        ╚═══════╗                                 │ │
│  │                🚚 Chofer actual                  │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│  [Recorrido de Juan Pérez - Ruta #45] ← Badge visible  │
└─────────────────────────────────────────────────────────┘
```

### 2. Frecuencia de Captura de Datos Mejorada

El análisis de datos reales muestra brechas de hasta 1 hora entre puntos. Mejoras:
- Reducir intervalo de guardado de 30s a 15s cuando hay movimiento
- Detectar movimiento significativo (>50m) para forzar guardado inmediato
- Mantener 30s cuando el chofer está detenido (evitar duplicados)

### 3. Preprocesamiento de Rutas Largas

Google Roads API tiene límite de 100 puntos. Para rutas extensas:
- Procesamiento por lotes con solapamiento (ya implementado)
- Caché de segmentos ya procesados para evitar reprocesar
- Indicador de progreso durante el procesamiento

### 4. Estilo Visual Mejorado

Actualizar el estilo de Polyline para mayor similitud con navegación GPS:
- Línea principal azul brillante (#4285F4) - ya implementado
- Borde/sombra para contraste - ya implementado
- Flechas de dirección cada 150px - ya implementado
- Gradiente opcional para indicar progreso temporal

---

## Implementación Técnica

### Fase 1: Hook de Geolocalización Mejorado
Modificar `useGeolocation.ts` para:
- Calcular distancia desde último punto guardado
- Forzar guardado si distancia > 50 metros
- Reducir intervalo base a 15 segundos

### Fase 2: Vista Principal con Recorrido
Modificar `LiveMap.tsx` para:
- Añadir estado para chofer seleccionado en vista de mapa
- Cargar historial + snap al seleccionar
- Renderizar polyline en mapa principal (no solo en diálogo)

### Fase 3: Caché de Segmentos Procesados
Crear tabla `driver_route_segments` para:
- Almacenar segmentos ya procesados con snap
- Evitar llamadas repetidas a Roads API
- Reducir latencia en visualización

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useGeolocation.ts` | Lógica de detección de movimiento |
| `src/pages/LiveMap.tsx` | Visualización en mapa principal |
| `src/components/maps/MapView.tsx` | Soporte para múltiples polylines |

---

## Datos Actuales

El sistema ya tiene 462 puntos de historial registrados. La ruta más reciente tiene 27 puntos en 2 horas, lo cual es suficiente para un buen snap to roads.

---

## Consideraciones

- **Costo de API**: Google Roads API tiene costo por 1000 elementos. La caché reduce llamadas.
- **Rendimiento**: Procesar rutas largas puede tomar 2-3 segundos. El indicador de carga ya existe.
- **Modo Offline**: El snap solo funciona con conexión; los puntos raw se muestran como fallback.
