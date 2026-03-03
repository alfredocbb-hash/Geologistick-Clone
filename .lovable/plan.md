

# Plan: Toggle "Incluir IVA / Agregar IVA" en el diálogo de facturación

## Problema actual
El diálogo de facturación asume siempre que el `importeTotal` recibido **ya incluye IVA 21%** y calcula el neto dividiendo por 1.21. No hay opción para indicar que el monto es neto (sin IVA) y que se debe agregar el 21% encima.

## Solución
Agregar un Switch/toggle en el diálogo `InvoiceDataDialog` con dos modos:
- **"IVA incluido"** (default, comportamiento actual): el total ya contiene IVA, se desglosa neto = total / 1.21
- **"Agregar IVA"**: el monto recibido es neto, se calcula total = neto * 1.21

El desglose visual se actualiza en tiempo real según la opción seleccionada, y se envía el `importe_total` correcto al backend.

## Cambios técnicos

### Modificar: `src/components/invoicing/InvoiceDataDialog.tsx`
- Agregar estado `ivaIncluido: boolean` (default `true`)
- Agregar un Switch con label "IVA incluido" / "Agregar IVA al monto"
- Calcular dinámicamente los montos según el toggle:
  - Si `ivaIncluido = true`: neto = importeTotal / 1.21, iva = total - neto (actual)
  - Si `ivaIncluido = false`: neto = importeTotal, iva = neto * 0.21, totalConIva = neto + iva
- Actualizar el bloque de desglose de montos para reflejar los valores correctos
- Enviar el `importe_total` correcto (con IVA) al backend en la mutation

### Backend (`arca-factura/index.ts`)
No requiere cambios: ya recibe `importe_total` y calcula el desglose internamente. Solo hay que asegurar que el frontend envíe el total correcto (siempre con IVA incluido).

## UI esperada
Debajo del bloque de montos, un switch:
```
[Toggle] IVA incluido en el monto
```
Cuando se desactiva, cambia a "Agregar IVA 21% al monto" y el desglose muestra:
- Neto: $10,000
- IVA 21%: $2,100  
- **Total: $12,100**

