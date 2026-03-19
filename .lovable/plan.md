

## Fase 2: Mejoras funcionales de valor

Ya se completó la Fase 1 (sparklines en dashboard, exportación Excel en reportes). Ahora toca la **Fase 2** con estas mejoras concretas:

---

### 1. Comparativa de períodos en Reportes
Agregar a la pestaña "Resumen General" una comparación automática con el período anterior (si selecciono "Último Mes", comparar con el mes previo).

- Mostrar en cada KPI card un indicador de cambio porcentual vs período anterior (flecha verde/roja + porcentaje)
- Modificar `useReportsData.ts` para hacer una segunda query con el rango anterior
- Actualizar las 4 KPI cards del resumen para mostrar la tendencia

**Archivos**: `src/hooks/useReportsData.ts`, `src/pages/Reports.tsx`

---

### 2. Mapa embebido en Tracking público
Cuando un envío está "en_reparto" o tiene coordenadas de destino, mostrar un mini-mapa entre la card de estado y los detalles de origen/destino.

- Usar Google Maps embed (ya existe `GOOGLE_MAPS_API_KEY` configurada)
- Mostrar marker en la dirección de destino (usando la dirección en texto con geocoding del embed)
- Si el envío tiene coordenadas del chofer (estado "en_reparto"), mostrar posición estimada
- Componente liviano con iframe de Google Maps Static API para no depender de JS SDK en página pública

**Archivos**: `src/pages/Tracking.tsx` (agregar sección de mapa), nuevo componente `src/components/tracking/TrackingMap.tsx`

---

### 3. Indicadores de ahorro en Optimización de Rutas
Después de optimizar una ruta en RoutePlanner, mostrar un panel comparativo "antes vs después":

- Distancia total original vs optimizada
- Tiempo estimado original vs optimizado  
- Porcentaje de ahorro
- El edge function `optimize-route` ya devuelve distancia/duración; hay que guardar el valor pre-optimización y comparar

**Archivos**: `src/pages/RoutePlanner.tsx` (agregar panel de ahorro post-optimización)

---

### 4. Dashboard de KPIs con indicadores visuales mejorados
Mejorar las KPI cards del resumen general en Reports con:

- Indicadores circulares (radial progress) para la tasa de entrega
- Usar el componente `Progress` existente estilizado como gauge
- Mini-sparkline en la card de "Total Envíos" mostrando la evolución diaria

**Archivos**: `src/pages/Reports.tsx` (sección resumen)

---

### Orden de implementación
1. Comparativa de períodos en Reports (más impacto inmediato, el usuario está en /reports)
2. KPI cards mejoradas en Reports
3. Mapa en Tracking público
4. Panel de ahorro en RoutePlanner

