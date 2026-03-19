

## Fase 6: Predicción de demanda por zona con IA

### Objetivo
Dashboard que analiza datos históricos de envíos y predice volumen de entregas por zona para los próximos días, ayudando a planificar choferes y recursos.

### Implementación

#### 1. Edge Function `predict-demand` 
- Consulta envíos de los últimos 30-90 días agrupados por zona (ciudad/localidad del destinatario)
- Envía resumen de volúmenes históricos por zona y día de la semana a Lovable AI (gemini-3-flash-preview)
- IA devuelve predicción estructurada (tool calling) con: zona, volumen estimado próximos 3 días, tendencia (creciendo/estable/bajando), confianza
- **Archivo**: `supabase/functions/predict-demand/index.ts`

#### 2. Componente `DemandPredictionTab`
- Nueva pestaña "Demanda" en `src/pages/Reports.tsx`
- Tabla con zonas, volumen histórico promedio, predicción próximos 3 días, tendencia con badges de color
- Gráfico de barras comparando volumen real vs predicción por zona
- Botón "Actualizar predicción" que invoca la edge function
- **Archivo**: `src/components/reports/DemandPredictionTab.tsx`

#### 3. Hook `useDemandPrediction`
- Invoca la edge function y cachea resultados en estado local
- Maneja loading, error, y rate limiting (429/402)
- **Archivo**: `src/hooks/useDemandPrediction.ts`

#### 4. Integración con Heatmap existente
- Opción de visualizar predicción en el mapa de calor del LiveMap, mostrando zonas con mayor demanda esperada

### Datos de entrada para la IA
```text
Zona: "Palermo" | Lun: 45 | Mar: 52 | Mié: 38 | Jue: 41 | Vie: 60 | Sáb: 25
Zona: "Flores"  | Lun: 30 | Mar: 28 | Mié: 35 | Jue: 32 | Vie: 40 | Sáb: 15
...
```

### Salida estructurada de la IA
```json
{
  "predicciones": [
    { "zona": "Palermo", "dia1": 48, "dia2": 55, "dia3": 42, "tendencia": "creciendo", "confianza": 0.8 },
    ...
  ],
  "resumen": "Se espera un aumento del 12% en Palermo..."
}
```

### Archivos a crear/modificar
- **Crear**: `supabase/functions/predict-demand/index.ts`, `src/components/reports/DemandPredictionTab.tsx`, `src/hooks/useDemandPrediction.ts`
- **Modificar**: `src/pages/Reports.tsx` (nueva pestaña), `.lovable/plan.md`

