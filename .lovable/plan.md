

# Fix: Conceptos de otros tenants + Resumen de precio no refleja importe editable

## Problema 1: Conceptos de otros tenants visibles

Siendo super admin, la vista de conceptos muestra TODOS los conceptos de todos los tenants. Esto es confuso porque se mezclan conceptos de diferentes empresas. La solucion es filtrar los conceptos segun el tenant de la tarifa seleccionada cuando se esta en la vista de precios por concepto, y en la tabla general mostrar claramente a que tenant pertenece cada concepto para evitar confusion.

**Cambio**: En `Rates.tsx`, la tabla de conceptos ya muestra el badge del tenant. Para evitar confusion, se agregara un filtro por tenant en la tabla de conceptos cuando hay un tenant seleccionado/visible, para que el super admin pueda filtrar por empresa.

## Problema 2: Resumen de precio muestra $0 para conceptos editables

El calculo del total SI usa el valor ingresado en el input (linea 608 de `NewShipment.tsx`), pero la seccion "Resumen de Precio" (lineas 2474-2510) NO lo usa. La linea 2482-2484 calcula el monto con `Number(cp.monto)` (que es 0 para conceptos editables) en lugar de usar `montosEditables[cp.concepto_id]`.

**Cambio**: En la seccion de Resumen de Precio, para conceptos adicionales con `monto_editable`, usar el valor de `montosEditables` en lugar de `cp.monto`.

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/pages/NewShipment.tsx` | En el Resumen de Precio (lineas 2474-2510), usar `montosEditables[cp.concepto_id]` cuando el concepto es editable |
| `src/pages/Rates.tsx` | Agregar filtro por tenant en la tabla de conceptos para que el super admin pueda ver solo los de un tenant especifico |

## Detalle tecnico

### NewShipment.tsx - Resumen de Precio (lineas ~2482-2484)

Antes:
```typescript
let calculatedAmount = isPercentage 
  ? valorDeclarado * Number(cp.porcentaje) / 100 
  : Number(cp.monto);
```

Despues:
```typescript
let calculatedAmount = 0;
if (cp.concepto?.monto_editable && montosEditables[cp.concepto_id]) {
  calculatedAmount = parseFloat(montosEditables[cp.concepto_id]) || 0;
} else if (isPercentage) {
  calculatedAmount = valorDeclarado * Number(cp.porcentaje) / 100;
} else {
  calculatedAmount = Number(cp.monto);
}
```

### Rates.tsx - Filtro de conceptos por tenant

Agregar un selector/filtro de tenant en la seccion de conceptos para que el super admin pueda ver solo los conceptos de una empresa especifica, en lugar de ver todos mezclados.

