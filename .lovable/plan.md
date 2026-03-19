

## Análisis: Sistema actual vs. Contenido visual del Marketing

Las 6 temáticas de marketing (`01-hero` a `06-reports`) muestran visualmente funcionalidades y vistas del sistema. A continuación, el análisis de qué existe y qué falta.

---

### Lo que YA está implementado (funcional)

| Tema Marketing | Página/Feature | Estado |
|---|---|---|
| 01 - Hero/General | Dashboard con stats, envíos recientes, resumen del día | Funcional pero visualmente básico |
| 02 - Tracking | Tracking público (`/tracking/:code`), LiveMap con GPS | Funcional y completo |
| 03 - Mobile | App móvil completa (home, rutas, escaneo, entregas, perfil) | Funcional |
| 04 - E-commerce | Dashboard e-commerce, sellers, órdenes, liquidaciones | Funcional |
| 05 - Rutas | RoutePlanner con drag-and-drop, optimización IA, LiveMap | Funcional |
| 06 - Reports | Reportes con gráficos (barras, líneas, pie), exportación PDF | Funcional |

---

### Lo que FALTA o se puede MEJORAR

#### 1. Dashboard principal - Mejoras visuales significativas
- **Falta**: Gráficos de tendencia (evolución diaria/semanal de envíos) directamente en el dashboard
- **Falta**: Mini-mapa con actividad en tiempo real embebido en el dashboard
- **Falta**: Widget de rendimiento de choferes (top 5, porcentaje de entregas exitosas)
- **Mejora**: Las cards de stats son muy simples; agregar sparklines o indicadores de tendencia (+12% vs ayer)

#### 2. Tracking - Mejoras de experiencia
- **Falta**: Vista de mapa embebida en la página de tracking público mostrando la ubicación actual del envío
- **Mejora**: Timeline visual más atractiva (actualmente es funcional pero sin animaciones ni iconografía rica)

#### 3. App Móvil - Mejoras visuales
- **Falta**: Animaciones de transición entre pantallas
- **Falta**: Ilustraciones en estados vacíos (actualmente solo íconos)
- **Mejora**: Diseño más "app nativa" con cards más estilizadas y micro-interacciones

#### 4. E-commerce - Funcionalidades pendientes
- **Falta**: Dashboard de seller con vista de "mis ventas" más visual (gráficos de tendencia por seller)
- **Falta**: Notificaciones push cuando una orden cambia de estado
- **Mejora**: Panel de integración con más feedback visual del estado de sincronización

#### 5. Optimización de rutas - Mejoras
- **Falta**: Visualización antes/después de la optimización (comparación de distancia/tiempo)
- **Falta**: Indicadores de ahorro estimado (km, tiempo, combustible)
- **Mejora**: Animación en el mapa mostrando la ruta optimizada

#### 6. Reportes y Liquidaciones - Mejoras
- **Falta**: Dashboard de KPIs más visual con gauges/indicadores circulares
- **Falta**: Comparativa de períodos (este mes vs. mes anterior)
- **Falta**: Heatmap de entregas por zona geográfica
- **Mejora**: Exportación a Excel (actualmente solo PDF)

---

### Nuevas funcionalidades que el marketing sugiere pero NO existen

1. **Predicciones con IA**: Las imágenes sugieren "predicciones" pero no hay módulo predictivo
2. **Notificaciones push reales**: Existe la estructura pero falta integración con FCM/OneSignal para push nativo
3. **White Label completo en tracking**: El branding existe parcialmente, faltaría dominio custom por tenant en el tracking
4. **Comparativa de rendimiento entre sucursales**: No hay vista dedicada
5. **Dashboard de SLA**: No hay medición de tiempos de entrega vs. promesa

---

### Plan de implementación recomendado (por prioridad)

**Fase 1 - Quick wins visuales (alto impacto, poco esfuerzo)**
- Agregar sparklines/tendencias a las stats cards del Dashboard
- Mejorar empty states con ilustraciones de las imágenes de marketing
- Agregar comparativa "vs ayer" en las métricas del dashboard

**Fase 2 - Funcionalidades de valor (impacto medio-alto)**
- Gráfico de evolución de envíos en el Dashboard principal
- Exportación a Excel en Reportes
- Vista de mapa en tracking público
- Comparativa de períodos en reportes

**Fase 3 - Features avanzados**
- Dashboard de KPIs con gauges
- Heatmap de entregas por zona
- Métricas de SLA
- Predicciones básicas con IA

### Archivos principales a modificar
- `src/pages/Dashboard.tsx` - Gráficos, sparklines, tendencias
- `src/pages/Reports.tsx` - Comparativas, exportación Excel, heatmap
- `src/pages/Tracking.tsx` - Mapa embebido en tracking público
- `src/pages/RoutePlanner.tsx` - Visualización antes/después de optimización
- Componentes de empty states en múltiples páginas
- `src/pages/LiveMap.tsx` - Mini widget para dashboard

