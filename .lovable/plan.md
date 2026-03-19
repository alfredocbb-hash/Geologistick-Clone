

## Fase 3: Features avanzados

Fases 1 y 2 ya completadas. Ahora toca la **Fase 3** con funcionalidades avanzadas:

---

### 1. Comparativa de rendimiento entre sucursales
Nueva sección en Reports con una tabla/gráfico comparativo que muestre por sucursal:
- Total envíos, tasa de entrega, tiempo promedio de entrega
- Ranking visual de sucursales (barras horizontales)
- Query agrupando `envios` por `sucursal_origen_id` y `sucursal_destino_id`

**Archivos**: `src/pages/Reports.tsx` (nueva pestaña "Sucursales"), `src/hooks/useReportsData.ts`

---

### 2. Dashboard de SLA (cumplimiento de tiempos)
Medir el tiempo entre creación del envío y entrega vs. la fecha estimada (`fecha_entrega_estimada`):
- Porcentaje de envíos entregados a tiempo vs. con demora
- Gráfico de distribución de tiempos de entrega (histograma)
- Card resumen: "85% de entregas a tiempo" con gauge circular
- Integrar como nueva pestaña "SLA" en Reports

**Archivos**: `src/pages/Reports.tsx` (nueva pestaña), `src/hooks/useReportsData.ts` (nueva query)

---

### 3. Empty states ilustrados en páginas principales
Reemplazar los estados vacíos genéricos con ilustraciones y CTAs contextuales:
- Shipments: "Aún no tenés envíos. Creá tu primer envío →"
- Routes: "Planificá tu primera ruta optimizada →"
- Drivers: "Agregá choferes a tu equipo →"
- Usar SVG inline o íconos animados (sin depender de imágenes externas del bucket)

**Archivos**: Nuevo componente `src/components/EmptyState.tsx`, modificaciones en `src/pages/Shipments.tsx`, `src/pages/Routes.tsx`, `src/pages/Drivers.tsx`

---

### 4. Mini-mapa de actividad en Dashboard
Widget embebido en el Dashboard principal mostrando las sucursales del tenant en un mapa estático:
- Markers por sucursal con badge de envíos pendientes
- Usa Google Maps Embed API (misma API key del tracking)
- Card compacta con altura fija de 250px

**Archivos**: Nuevo componente `src/components/dashboard/DashboardMiniMap.tsx`, `src/pages/Dashboard.tsx`

---

### Orden de implementación
1. Comparativa entre sucursales (extiende Reports que ya se mejoró)
2. Dashboard de SLA (nueva pestaña en Reports)
3. Empty states ilustrados (mejora visual rápida)
4. Mini-mapa en Dashboard

