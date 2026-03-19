

## Plan: Fase 5 + ETA dinámico por parada

### Implementación completa

#### 1. Productividad por chofer (nueva pestaña en Reports)
- Nueva pestaña "Productividad" en `src/pages/Reports.tsx` con métricas por chofer: entregas/hora, tasa de éxito, ranking con barras horizontales
- Extender `src/hooks/useReportsData.ts` con query `productividadChoferes` calculando tiempo entre estados `en_reparto` → `entregado` desde `envio_historial`

#### 2. Dashboard de costos operativos (nueva pestaña en Reports)
- Nueva pestaña "Costos" en `src/pages/Reports.tsx`: costo estimado por entrega, combustible (km × 12L/100km × precio configurable), comparativa por chofer
- Extender `useReportsData.ts` con query sobre `ruta_tracking` y distancias

#### 3. ETA dinámico por parada en ActiveRouteNavigation
Reemplazar el ETA hardcodeado ("~10 min / 2.5 km") con cálculo real:

- **Calcular distancia Haversine** entre la ubicación actual del chofer (ya disponible via `useGeolocation`) y las coordenadas de cada parada (`entrega_lat/lng` o `remitente_lat/lng`)
- **Estimar tiempo** usando velocidad promedio de 25 km/h en zona urbana
- **Mostrar ETA acumulado** por parada: parada 1 = distancia chofer→parada1, parada 2 = ETA1 + distancia parada1→parada2 + 5min de gestión por parada
- **Hora estimada de llegada** = hora actual + ETA acumulado

**Cambios en `ActiveRouteNavigation.tsx`**:
- Crear `useMemo` que calcule `etaByStopId` usando `location` del chofer y coordenadas de cada parada pendiente
- Mostrar ETA real en la "Next Stop Card" (línea ~672)
- Mostrar hora estimada en cada parada de la lista (línea ~853)
- Si no hay ubicación del chofer, mostrar "ETA no disponible"

**Sin edge functions ni APIs externas** — cálculo client-side con Haversine (suficiente para estimaciones urbanas).

### Archivos a modificar
- `src/hooks/useReportsData.ts` — queries de productividad y costos
- `src/pages/Reports.tsx` — 2 nuevas pestañas
- `src/pages/ActiveRouteNavigation.tsx` — ETA dinámico por parada

### Orden
1. ETA dinámico (impacto inmediato para choferes)
2. Productividad por chofer
3. Dashboard de costos

