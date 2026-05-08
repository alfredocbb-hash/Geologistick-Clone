# Mostrar detalle de ítems en la factura impresa

## Problema
En `src/pages/Facturacion.tsx` (handleEmitDuplicate) ya se envían correctamente los `line_items` al edge function `arca-factura`, y éste los persiste en `facturas.line_items`. Sin embargo, la vista de impresión `src/pages/PrintInvoice.tsx` aplana cada `line_item` a `{ nombre_concepto, monto }` y los renderiza en una tabla minimalista de dos columnas (CONCEPTO | IMPORTE). Por eso no se ven cantidad, precio unitario, unidad, IVA, etc.

## Cambio propuesto

**Archivo único:** `src/pages/PrintInvoice.tsx`

1. Detectar si la factura tiene `line_items` con datos (cantidad/precio/IVA). En ese caso, renderizar una tabla detallada en lugar del bloque simple actual (líneas ~715-731).

2. Nueva tabla detallada con columnas:
   - Código
   - Descripción
   - Cant.
   - U. Medida
   - P. Unit.
   - % Bonif.
   - IVA %
   - Subtotal (cantidad × precio_unitario − bonificación)

   Reutilizar las funciones `calcLineSubtotal` exportadas desde `src/components/invoicing/InvoiceLineItems.tsx` para mantener un solo cálculo de subtotal.

3. Para los casos existentes (liquidación de seller, flete de envío, conceptos sin line_items), mantener exactamente la tabla actual de dos columnas — no cambia nada.

4. Estilos compatibles con impresión y PDF: usar las mismas clases (`border rounded-lg`, `text-sm`, `bg-muted/50`) y asegurar `overflow-x-auto` para que el `html2canvas` capture todas las columnas dentro del A4.

## Detalles técnicos

- Importar `calcLineSubtotal` y el tipo `LineItem` desde `@/components/invoicing/InvoiceLineItems`.
- Reemplazar el bloque condicional `conceptosAMostrar` (líneas 366-381) por dos ramas:
  - Si hay `lineItemsFactura.length > 0` y al menos un ítem tiene `cantidad` o `precio_unitario`, usar render detallado.
  - Si no, conservar el render actual (`conceptosAMostrar`).
- En el render detallado, formatear moneda con la función `formatCurrency` ya existente y porcentajes con un decimal.
- No tocar totales (`importe_neto` / `importe_iva` / `importe_total`) — se siguen tomando de la factura.

## Fuera de alcance

- No se modifica `arca-factura` (ya guarda `line_items`).
- No se cambia el flujo de duplicado (`Facturacion.tsx`).
- No se altera el cálculo de IVA ni los totales de la factura.
