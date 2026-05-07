## Ajuste de orden del historial en EPOD

### Problema
En el PDF EPOD, la seccion **HISTORIAL DE ESTADOS** muestra los estados del mas antiguo al mas reciente (abajo). El usuario necesita el estado mas reciente arriba.

### Solucion
Modificar `src/lib/generateEPODPDF.ts`:

1. **Invertir orden del sort** (linea ~528): cambiar `a - b` por `b - a` para orden descendente por fecha.
2. **Ajustar indicador de estado actual**: actualmente el punto verde se asigna al ultimo elemento del array (`isLast`). Al invertir el orden, el mas reciente pasa a ser el primero (`index === 0`). Separar la logica en:
   - `isMostRecent = index === 0` → punto verde
   - `index < sortedHistorial.length - 1` → dibujar linea de timeline hacia el siguiente estado

### Resultado
El EPOD mostrara la timeline con el estado mas reciente en la parte superior y el mas antiguo abajo, manteniendo el punto verde en el estado actual.