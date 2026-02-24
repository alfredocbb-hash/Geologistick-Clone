

# Fix: Detalle de Seguro muestra $0 pero el Total lo incluye

## Problema

Cuando no se ingresa un valor declarado, el "Resumen de Precio" muestra el concepto "Seguro" en $0, pero el Total ya incluye el importe del seguro calculado con el valor minimo declarado configurado. Esto genera una inconsistencia visual (ej: Flete $10,000 + Seguro $0 = Total $12,000).

## Causa raiz

Hay dos lugares donde se calcula el importe de los conceptos:

1. **Calculo del total** (linea 575): usa `parseFloat(formData.valor_declarado) || configSeguro?.valor_minimo_declarado` como fallback -- correcto
2. **Visualizacion del detalle** (linea 2416): usa `parseFloat(formData.valor_declarado) || 0` sin fallback -- incorrecto

Esto hace que el total sume $2,000 de seguro pero la linea individual muestre $0.

## Solucion

Actualizar la visualizacion de conceptos basicos y adicionales en el "Resumen de Precio" para que use el mismo fallback al valor minimo declarado que usa el calculo del total.

## Cambio tecnico

| Archivo | Accion | Descripcion |
|---|---|---|
| `src/pages/NewShipment.tsx` | Modificar | En las lineas 2416 y 2453, cambiar `parseFloat(formData.valor_declarado) \|\| 0` por `parseFloat(formData.valor_declarado) \|\| (configSeguro?.valor_minimo_declarado \|\| 0)` para que el detalle refleje el mismo valor que el calculo |

El mismo cambio se aplica en dos bloques:
- Linea 2416: renderizado de conceptos basicos
- Linea 2453: renderizado de conceptos adicionales

No se requieren cambios en la base de datos.
