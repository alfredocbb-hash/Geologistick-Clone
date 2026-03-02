

# Agregar impresion de factura desde liquidacion de seller

## Problema

1. La pagina `/print-invoice` busca la factura por `envio_id` en la URL (`?id=envioId`). Para facturas de liquidaciones de seller no hay `envio_id`, la referencia es `liquidacion_seller_id`. Resultado: la factura nunca se encuentra.

2. El dialogo `SellerLiquidacionDetailDialog` muestra los datos de la factura emitida pero no tiene boton para imprimirla o descargarla.

## Plan de cambios

### 1. Ampliar PrintInvoice para soportar busqueda por factura_id

**Archivo**: `src/pages/PrintInvoice.tsx`

- Leer un segundo parametro de URL: `factura_id` (ademas del existente `id` para envio_id)
- Si viene `factura_id`, buscar directamente en la tabla `facturas` por su ID primario
- Si viene `id` (envio_id), mantener la logica actual (buscar por `envio_id`)
- Adaptar la query de `envio` para que sea opcional (puede no haber envio asociado si es factura de liquidacion)

### 2. Agregar boton "Imprimir Factura" en SellerLiquidacionDetailDialog

**Archivo**: `src/components/ecommerce/SellerLiquidacionDetailDialog.tsx`

- Cuando la factura existe (`factura` no es null), mostrar un boton junto a la info de factura:
  - "Imprimir Factura" que abra `/print-invoice?factura_id={factura.id}` en nueva pestana
- Ubicarlo en la seccion "Factura Emitida" que ya existe en el dialogo

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/pages/PrintInvoice.tsx` | Soporte para `?factura_id=` ademas de `?id=` |
| `src/components/ecommerce/SellerLiquidacionDetailDialog.tsx` | Boton "Imprimir Factura" con link a PrintInvoice |

## Sin cambios de base de datos

No se requieren migraciones.
