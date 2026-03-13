

# Hacer editables los precios de envíos en la liquidación de seller

## Problema
Cuando se calculan los envíos para una liquidación, los precios se muestran como texto fijo. Si algún importe está mal (por zona incorrecta, precio $0, o cualquier error), no se puede corregir antes de generar la liquidación.

## Solución
Convertir la columna "Precio" de la tabla de envíos calculados en un campo `<Input>` editable. Al modificar un valor, se actualiza el estado local (`calculatedEnvios`) y se recalculan los totales automáticamente.

## Cambios en `src/pages/ecommerce/Settlements.tsx`

### 1. Función para editar precio de un envío
Agregar un handler que actualice el precio de un envío en `calculatedEnvios` y recalcule `calculatedTotals.totalEnvios` y `saldoPeriodo`.

### 2. Columna de precio editable (líneas ~1386-1401)
Reemplazar el `<span>` de precio por un `<Input type="number">` con el valor actual, que al cambiar llame al handler. Mantener los badges de "Zona" y "Sin precio" como indicadores visuales al lado del input.

### 3. Recálculo automático de totales
Cuando se edita un precio, recalcular `totalEnvios` sumando todos los `precio_total` de `calculatedEnvios`, y actualizar `saldoPeriodo = totalCargos + totalEnvios - totalPagos`.

| Archivo | Cambio |
|---------|--------|
| `Settlements.tsx` | Input editable en columna precio + recálculo de totales al editar |

