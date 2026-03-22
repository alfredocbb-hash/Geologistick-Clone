

## Plan: Soporte de dimensiones en API public-rates (COMPLETADO)

### Correcciones aplicadas

1. **Nuevos parámetros**: `largo`, `ancho`, `alto` (cm, opcionales) aceptados por POST body o query string.

2. **Consulta de tarifas enriquecida**: Se incluyen `precio_por_m3` y `umbral_volumen_cm` en el SELECT.

3. **Lógica de volumen con prioridad máxima**: Si alguna dimensión supera `umbral_volumen_cm` y `precio_por_m3 > 0`, el flete se calcula como `precioBase + (volumen_m3 × precio_por_m3)` con `metodo = 'volumen_excedido'`.

4. **Respuesta enriquecida**: Cuando aplica volumen, se incluye `detalle_volumen` con dimensiones, volumen en m³ y umbral usado.
