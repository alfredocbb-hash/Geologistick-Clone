

# Mejoras con IA para Mapa en Vivo / Choferes en Ruta

## Funcionalidades actuales
La sección ya tiene: tracking GPS en tiempo real, visualización de recorridos con Snap to Roads, estadísticas de rutas, detección de brechas de señal, y lista de choferes con estado (activo/reciente/sin señal).

## Mejoras posibles con IA

### 1. Estimación inteligente de hora de entrega (ETA)
Usar la IA para analizar la posición actual del chofer, las paradas restantes, y el historial de velocidad/tiempos para estimar cuándo llegará a cada parada pendiente. Mostrar un badge "ETA: ~14:30" junto a cada chofer con ruta activa.

### 2. Detección de anomalías en ruta
La IA analiza el recorrido del chofer vs. la ruta planificada y detecta desvíos significativos, paradas prolongadas no planificadas, o comportamiento inusual. Muestra alertas como "⚠️ Detenido 25 min en ubicación no planificada".

### 3. Resumen inteligente del día
Un botón "Resumen IA" que genera un análisis narrativo del rendimiento de los choferes: quién fue más eficiente, quién tuvo más incidencias, tiempos promedio por entrega, y sugerencias de mejora.

### 4. Predicción de demoras
Basándose en la velocidad actual, cantidad de paradas restantes y horarios, la IA predice si un chofer va a completar su ruta a tiempo o si hay riesgo de demora, permitiendo reasignar envíos proactivamente.

## Plan técnico

| Componente | Cambio |
|-----------|--------|
| Nueva edge function `analyze-driver-route` | Recibe posición actual, paradas pendientes, historial GPS; usa Lovable AI (gemini-3-flash-preview) para generar ETA, detectar anomalías y predecir demoras |
| `src/pages/LiveMap.tsx` | Agregar botón "Análisis IA" por chofer que invoca la edge function y muestra resultados en un panel/dialog |
| `src/pages/LiveMap.tsx` | Agregar panel de "Resumen IA" general que analiza todos los choferes activos |

### Edge function: `analyze-driver-route`
- Input: `{ driverId, routeId, currentPosition, pendingStops[], completedStops[], locationHistory[] }`
- Usa tool calling para retornar estructura: `{ eta_next_stop, eta_completion, anomalies[], delay_risk, summary }`
- Modelo: `google/gemini-3-flash-preview` (rápido y económico)

### UI: Panel de análisis por chofer
- Botón "🤖 Análisis" junto a cada chofer con ruta activa
- Muestra: ETA próxima parada, riesgo de demora (🟢🟡🔴), anomalías detectadas
- Se integra en la tarjeta del chofer existente

### UI: Resumen general con IA
- Botón "Resumen IA" en el header de la tab "Choferes en Ruta"
- Dialog con análisis narrativo generado por IA de toda la operación en curso

### Archivos a crear/modificar
- **Crear**: `supabase/functions/analyze-driver-route/index.ts`
- **Modificar**: `src/pages/LiveMap.tsx` (agregar botones de análisis IA + panels de resultado)

