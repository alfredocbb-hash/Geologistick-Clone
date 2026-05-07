## Encuadrar bien el número de bultos dentro del bloque

En la última versión, el `1 / 2` queda cortado por arriba/abajo del recuadro. Ajustar `drawLabel` en `src/pages/PrintLabel.tsx` (Row 9, líneas 420-441) para que el número quede **centrado verticalmente y nunca se desborde**:

1. Calcular el tamaño de fuente máximo a partir de la altura disponible (`bultosBoxH - labelH - padding`) usando la relación cap-height ≈ `fontSize * 0.247 mm`, en vez de `bultosBoxH * 2.0`.
2. Centrar el número usando `baseline: 'alphabetic'` con `y = labelTop + capHeight/2 + centroVertical` para evitar el corte superior/inferior.
3. Mantener el auto-shrink por ancho (sigue achicando si no entra horizontalmente).
4. Topear en 80pt para evitar tamaños desmedidos en etiquetas grandes.

Sin cambios en el resto del layout.
