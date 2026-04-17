

## Problema
En `src/pages/Branches.tsx` (líneas 251-292), el `useEffect` que inicializa `emisionCommissionData` y `recepcionCommissionData` depende de `sucursalComisiones` y `orphanConceptNames`. Estos valores provienen de `useQuery` con defaults `= []` y `= {}` aplicados en el destructuring, lo que **crea nuevas referencias en cada render**.

Resultado: cada tecla que el admin de Beraexpress presiona en un input de comisión → re-render → el `useEffect` se vuelve a disparar → el state se resetea al valor original de la BD (`'0'`) → el carácter tecleado desaparece. Por eso no puede ingresar números.

## Solución
Hacer que el `useEffect` se ejecute **solo cuando cambia la sucursal seleccionada o cuando los datos de la BD realmente cambian** (no cuando cambian las referencias de los arrays).

Cambios en `src/pages/Branches.tsx`:

1. **Agregar un guard con flag de inicialización por sucursal**: usar un `useRef` que recuerde el ID de la última sucursal inicializada, y solo re-ejecutar la inicialización cuando:
   - Cambia `selectedSucursalForCommissions?.id`, o
   - El usuario cierra y reabre el diálogo de comisiones.

2. **Estabilizar las dependencias**: en vez de depender de `sucursalComisiones` y `orphanConceptNames` (referencias de array/objeto), depender de:
   - `selectedSucursalForCommissions?.id`
   - `conceptosFiltrados.length`
   - `sucursalComisiones.length` (primitivo)

   y leer los valores actuales dentro del efecto. Así, escribir en un input no resetea el formulario.

3. **Limpiar el flag** cuando se cierra el diálogo de comisiones, para que al reabrirlo se vuelva a inicializar con datos frescos.

## Archivos a modificar
| Archivo | Cambio |
|---------|--------|
| `src/pages/Branches.tsx` | Estabilizar dependencias del useEffect de inicialización de comisiones (líneas 249-292) y limpiar flag al cerrar el diálogo |

## Riesgo
Bajo. Solo afecta el momento de inicialización del formulario de comisiones; la lógica de guardado y de cálculo no cambia.

