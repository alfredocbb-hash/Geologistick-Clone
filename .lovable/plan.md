

# Plan: Trazabilidad Calle por Calle con Snap to Roads

## Situación Actual

El sistema actualmente:
- **Registra ubicaciones cada 60 segundos** en la tabla `driver_location_history`
- **Dibuja líneas rectas** entre puntos GPS usando un `Polyline` simple
- El resultado son trazos geométricos que atraviesan edificios/manzanas

## Solución Propuesta

Implementar **Google Roads API (Snap to Roads)** para convertir las coordenadas GPS en rutas reales sobre calles.

---

## Arquitectura de la Solución

```text
┌─────────────────────────────────────────────────────────────────┐
│                   FLUJO DE DATOS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. driver_location_history                                     │
│     ├── lat, lng (puntos GPS cada 60s)                         │
│     └── [sin procesar]                                          │
│                                                                 │
│              ▼                                                  │
│                                                                 │
│  2. Edge Function: snap-to-roads                                │
│     ├── Recibe array de puntos                                  │
│     ├── Llama a Google Roads API                                │
│     └── Retorna coordenadas ajustadas a calles                  │
│                                                                 │
│              ▼                                                  │
│                                                                 │
│  3. MapView con Polyline detallado                              │
│     ├── Traza suave sobre calles reales                         │
│     └── Similar a Google Maps Navigation                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cambios Técnicos

### 1. Nueva Edge Function: `snap-to-roads`

Creará una función serverless que procesa los puntos GPS y los ajusta a las calles reales usando la **Google Roads API**.

**Archivo:** `supabase/functions/snap-to-roads/index.ts`

```typescript
// Puntos de entrada
interface SnapRequest {
  points: { lat: number; lng: number; }[];
  interpolate?: boolean; // Rellenar puntos entre coordenadas
}

// API de Google Roads
const roadsUrl = `https://roads.googleapis.com/v1/snapToRoads?path=${path}&interpolate=${interpolate}&key=${apiKey}`;
```

**Características:**
- Acepta hasta 100 puntos por solicitud (límite de Google)
- Opción de `interpolate=true` para generar puntos intermedios
- Usa la misma clave de API de Google Maps (por tenant o fallback)
- Retorna puntos ajustados a calles reales

---

### 2. Actualizar LiveMap.tsx

**Archivo:** `src/pages/LiveMap.tsx`

Modificar la función `loadRouteHistory` para:

```typescript
// Después de cargar el historial
const { data: snappedPath } = await supabase.functions.invoke('snap-to-roads', {
  body: { 
    points: rawPoints,
    interpolate: true 
  }
});

setRouteHistory(snappedPath.snappedPoints);
```

---

### 3. Actualizar MapView.tsx (opcional mejora visual)

**Archivo:** `src/components/maps/MapView.tsx`

Mejorar el estilo del Polyline para rutas procesadas:

```typescript
// Polyline mejorado para rutas snapped
<Polyline
  path={polylinePath}
  options={{
    strokeColor: '#4285F4', // Azul Google Maps
    strokeWeight: 5,
    strokeOpacity: 0.9,
    geodesic: true,
    icons: [{ 
      icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW },
      repeat: '100px' 
    }],
  }}
/>
```

---

### 4. Consideraciones de Frecuencia de Muestreo

**Opcional - Aumentar frecuencia de tracking:**

Modificar `src/hooks/useGeolocation.ts`:

```typescript
// Cambiar de 60s a 30s para historial
if (now - lastHistoryUpdateRef.current >= 30000) { // 30 segundos
  // Guardar en historial
}
```

> Nota: Esto aumenta el uso de datos y almacenamiento. Recomendado solo si el snap-to-roads no da resultados suficientemente detallados.

---

## Archivos a Crear/Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/snap-to-roads/index.ts` | **NUEVO** - Edge Function para Roads API |
| `src/pages/LiveMap.tsx` | Integrar llamada a snap-to-roads al cargar historial |
| `src/components/maps/MapView.tsx` | Mejorar estilos de Polyline (opcional) |
| `supabase/config.toml` | Agregar configuración de la nueva función |

---

## Flujo de Usuario Final

1. **Admin hace clic en "Ver recorrido"** de un chofer
2. **Se cargan los puntos GPS** del historial
3. **Se llama a `snap-to-roads`** para procesar los puntos
4. **El mapa muestra** la ruta ajustada a las calles reales
5. **El resultado visual** es similar a una ruta de navegación GPS

---

## Limitaciones y Costos

### Google Roads API
- **Límite gratuito:** 2,500 solicitudes/día (con cuenta básica)
- **Costo adicional:** $0.005 por solicitud después del límite
- **Máximo 100 puntos** por solicitud (el código lo manejará en batches)

### Alternativa sin costo adicional
Si prefieres evitar costos de Roads API, puedo implementar un **algoritmo de suavizado local** usando Bezier curves que mejora visualmente sin llamar APIs externas (aunque no será "calle por calle" exacto).

---

## Resultado Esperado

**Antes:** Líneas rectas entre puntos GPS (atraviesa edificios)

**Después:** Trazado suave siguiendo calles reales, similar a Google Maps

