

# Optimización de Rutas con IA

## Situación Actual
El planificador de rutas (`RoutePlanner.tsx`) usa un algoritmo **nearest-neighbor** que calcula distancia euclidiana (línea recta) entre paradas. Genera 2 opciones:
1. Retiros primero, luego entregas
2. Todo mezclado por distancia mínima

**Limitaciones**: No considera tráfico, franjas horarias reales, ni evalúa múltiples combinaciones. La distancia es en línea recta × 1.3 (factor de corrección).

## Plan

### 1. Crear edge function `optimize-route`
Nueva función que recibe las paradas con coordenadas y franjas horarias, y usa Lovable AI (Gemini Flash) para generar rutas optimizadas considerando:
- Proximidad geográfica real (clusters de zona)
- Franjas horarias preferidas (mañana/tarde/noche)
- Separación retiros vs entregas
- Sucursales como puntos intermedios

La IA recibirá las coordenadas y restricciones, y devolverá el orden óptimo de paradas usando **tool calling** para output estructurado.

### 2. Modificar `RoutePlanner.tsx`
Reemplazar el algoritmo nearest-neighbor por una llamada a la edge function. Se agrega una tercera opción de ruta: "🧠 Optimizada con IA" que aparece junto a las dos opciones existentes (que se mantienen como fallback rápido).

### Archivos a crear/modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/optimize-route/index.ts` | Nueva edge function con Lovable AI |
| `src/pages/RoutePlanner.tsx` | Agregar llamada a la edge function y opción IA |

### Detalle técnico
- Modelo: `google/gemini-3-flash-preview` (rápido y eficiente para este caso)
- Se usa tool calling para obtener output estructurado (array de índices ordenados)
- Fallback: si la IA falla, se mantienen las 2 opciones locales existentes
- La edge function NO persiste datos, solo calcula y devuelve el orden

