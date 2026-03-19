

## Plan: Fase 1 + Fase 2 — PhoneInput, EmptyState, ExportExcel, Rediseño NewShipment, Reportes Ampliados

### Fase 1 — Componentes base (sin riesgo)

#### 1.1 Crear `src/components/ui/phone-input.tsx`
- Input con ícono SVG de WhatsApp a la izquierda
- `onBlur`: auto-formatea números argentinos via `formatArgentinaPhone()`:
  - Quita espacios/guiones, quita `0` inicial del código de área, convierte `15`→`9`, agrega `+54`
- Check verde (CheckCircle2) cuando el número tiene ≥10 dígitos
- Exporta `formatArgentinaPhone` como utilidad reutilizable
- Props: `value: string`, `onChange: (value: string) => void`, + id, placeholder, required, className

#### 1.2 Integrar PhoneInput en formularios existentes
- **PersonalInfoCard.tsx** (línea ~126): reemplazar `<Input type="tel">` por `<PhoneInput>`, adaptar onChange de `e.target.value` a string directo
- **CreateSellerDialog.tsx** (línea ~410): reemplazar `<Input {...field}>` por `<PhoneInput value={field.value || ''} onChange={field.onChange}>`
- **EditSellerDialog.tsx** (línea ~473): mismo cambio

#### 1.3 Crear `src/components/EmptyState.tsx`
- Componente genérico con variantes: `shipments`, `routes`, `drivers`
- Cada variante tiene ícono (Lucide), título y descripción por defecto
- Props: `variant`, `title?`, `description?`, `actionLabel?`, `onAction?`
- Animación sutil en el ícono (pulse o bounce)

#### 1.4 Crear `src/lib/exportExcel.ts`
- Instalar dependencia `xlsx` (SheetJS)
- Función `exportToExcel(data: Record<string, any>[], filename: string, sheetName?: string)`
- Función `exportMultiSheetExcel(sheets: { name: string; data: any[] }[], filename: string)`

---

### Fase 2 — Rediseño y reportes (UI compleja)

#### 2.1 Rediseño `src/pages/NewShipment.tsx`
Reestructurar el layout del formulario manteniendo toda la lógica existente:

- **Header compacto**: título + badge de sucursal inline (en vez de Card separada)
- **Alertas compactadas**: caja y cuenta corriente en línea compacta
- **Grid de 3 columnas** (`grid-cols-1 lg:grid-cols-3`) para el formulario:
  - **Columna 1**: Card de Tipo de Servicio + Card de Tipo de Pago (apiladas)
  - **Columna 2**: Card de Remitente (con PhoneInput)
  - **Columna 3**: Card de Destinatario (con PhoneInput unificado teléfono+WhatsApp)
- **Detalles del paquete + Resumen de precio**: debajo del grid (full-width)
- **Footer sticky**: barra fija abajo con precio total + botones Cancelar/Crear
- Unificar campos `destinatario_telefono` y `destinatario_whatsapp` en un solo PhoneInput; el valor formateado se asigna a ambos campos
- Aplicar `formatArgentinaPhone()` al guardar

#### 2.2 Reportes ampliados — 3 nuevas tabs

**Nuevos hooks:**
- `src/hooks/useProductividadData.ts`: query `envios` agrupado por `chofer_id`, calcula entregas/hora, tasa de éxito, ranking
- `src/hooks/useCostosData.ts`: query `envios` + `rutas_planificadas` para costo por envío, costo por ruta, métricas operativas
- `src/hooks/useDemandPrediction.ts`: analiza datos históricos de envíos por día/zona, calcula tendencias y proyecciones simples (sin edge function por ahora — eso va en Fase 3)

**Nuevos componentes:**
- `src/components/reports/ProductividadTab.tsx`: ranking de conductores, entregas/hora, gráfico de barras comparativo
- `src/components/reports/CostosTab.tsx`: tabla de costos por ruta, costo promedio por envío, gráficos
- `src/components/reports/DemandPredictionTab.tsx`: gráfico de tendencia de demanda por día, proyección a 7 días basada en promedio móvil

**Modificar `src/pages/Reports.tsx`:**
- Ampliar TabsList de 4 a 7 tabs (agregar Productividad, Costos, Predicción)
- Integrar las 3 nuevas tabs
- Agregar botón "Exportar Excel" junto al botón PDF existente, usando `exportToExcel`

---

### Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `src/components/ui/phone-input.tsx` | Nuevo |
| `src/components/EmptyState.tsx` | Nuevo |
| `src/lib/exportExcel.ts` | Nuevo |
| `src/hooks/useProductividadData.ts` | Nuevo |
| `src/hooks/useCostosData.ts` | Nuevo |
| `src/hooks/useDemandPrediction.ts` | Nuevo |
| `src/components/reports/ProductividadTab.tsx` | Nuevo |
| `src/components/reports/CostosTab.tsx` | Nuevo |
| `src/components/reports/DemandPredictionTab.tsx` | Nuevo |
| `src/components/profile/PersonalInfoCard.tsx` | Modificar — PhoneInput |
| `src/components/ecommerce/CreateSellerDialog.tsx` | Modificar — PhoneInput |
| `src/components/ecommerce/EditSellerDialog.tsx` | Modificar — PhoneInput |
| `src/pages/NewShipment.tsx` | Modificar — rediseño 3 columnas + PhoneInput |
| `src/pages/Reports.tsx` | Modificar — 3 nuevas tabs + Excel export |
| `package.json` | Agregar dependencia `xlsx` |

### Dependencias nuevas
- `xlsx` (SheetJS) para exportación Excel

### Sin cambios de backend
No se crean migraciones, edge functions ni tablas nuevas. Todo es frontend/UI.

