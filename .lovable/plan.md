# Anulación de Facturas y Notas de Crédito

Implementación completa para gestionar la anulación de facturas y la emisión de Notas de Crédito (NC A/B/C) ante ARCA desde Facturación → Emitidas.

## Cambios en Base de Datos

Migración sobre `facturas`:
- `factura_origen_id UUID` (FK a `facturas.id`) — vincula NC con la factura original.
- `motivo_nota_credito TEXT` — motivo del ajuste.
- `es_nota_credito BOOLEAN DEFAULT false` — flag rápido para filtros.
- `anulada_at TIMESTAMPTZ`, `anulada_por UUID`, `motivo_anulacion TEXT`.
- Actualizar constraint `tipo_comprobante` para incluir `NC_A`, `NC_B`, `NC_C`.
- Index sobre `factura_origen_id`.

## Edge Function: `arca-factura`

Nueva acción `emitir_nota_credito`:
- Recibe `factura_origen_id`, `tipo` (NC_A/B/C), `items`, `motivo`, `total` (puede ser parcial).
- Determina `CbteTipo` AFIP: 3 (NC A), 8 (NC B), 13 (NC C).
- Llama `FECAESolicitar` con `CbtesAsoc` apuntando al `cbte_tipo`, `pto_vta` y `cbte_nro` de la factura original (requisito AFIP para asociar la NC).
- Reutiliza la caché del token WSAA (12h) ya existente.
- Persiste la NC en `facturas` con `es_nota_credito=true`, `factura_origen_id`, `cae`, `cae_vencimiento`.

## UI: `src/pages/Facturacion.tsx` (pestaña Emitidas)

Menú de acciones (⋮) por fila con lógica condicional:

1. **Anular (local)** — visible solo si `estado IN ('pendiente','rechazada','error')` y NO tiene `cae`.
   - Diálogo simple con motivo; marca `estado='anulada'`, registra `anulada_at/por/motivo_anulacion`.

2. **Emitir Nota de Crédito** — visible si la factura tiene `cae` y no está ya anulada por NC total.
   - Diálogo `CreditNoteDialog` con:
     - Tipo NC sugerido automáticamente según el tipo de la factura origen (A→NC_A, B→NC_B, C→NC_C).
     - Selector Total / Parcial.
     - Si Parcial: edición de items e importe.
     - Campo motivo obligatorio.
     - Vista previa: nro punto venta, totales, IVA discriminado.
   - Al confirmar: invoca `arca-factura` acción `emitir_nota_credito`.

3. **Ver NC asociadas** — listado de NCs con `factura_origen_id = factura.id`.

## Lógica contable / cuentas corrientes

Al confirmar una NC con CAE:
- Si la factura original está vinculada a `liquidacion_seller_id`: insertar movimiento negativo en `seller_cuenta_corriente` (revierte el cargo proporcional).
- Si está vinculada a `liquidacion_terciarizado_id`: registrar ajuste negativo en la liquidación del tercero.
- Si la NC es **total**, marcar la factura origen con `estado='anulada_por_nc'` y `anulada_at=now()`.
- Registrar entrada en `envio_historial` o log equivalente cuando aplique.

## Filtros y visualización

- Pestaña Emitidas: añadir filtro "Tipo": Facturas / Notas de Crédito / Todas.
- Badge visual:
  - `anulada` → rojo "Anulada"
  - `anulada_por_nc` → naranja "Anulada por NC"
  - `es_nota_credito=true` → azul "NC"
- En el detalle de una factura con NCs: mostrar tarjeta "Notas de Crédito asociadas" con link a cada una.

## Reportes

- Libro IVA Ventas: incluir NCs como filas con signo negativo (ya soportado por `tipo_comprobante`, solo verificar agrupación).
- Reporte de facturación: separar Bruto / NC / Neto.

## Archivos a modificar/crear

- `supabase/migrations/<timestamp>_facturas_nc_anulacion.sql` (nuevo)
- `supabase/functions/arca-factura/index.ts` (extender)
- `src/pages/Facturacion.tsx` (menú acciones + filtros)
- `src/components/facturacion/CreditNoteDialog.tsx` (nuevo)
- `src/components/facturacion/VoidInvoiceDialog.tsx` (nuevo)
- `src/components/facturacion/RelatedCreditNotes.tsx` (nuevo, opcional para detalle)

## Validaciones clave

- No permitir NC sobre una factura sin CAE → usar Anular.
- No permitir NC cuyo total exceda el saldo no acreditado de la factura origen.
- No permitir Anular si la factura ya tiene CAE → forzar NC.
- Solo `admin` / `super_admin` pueden anular o emitir NC.
- Si AFIP rechaza la NC, no persistir movimientos contables (transacción atómica).

¿Procedo con la implementación completa, o preferís dividirlo en fases (primero Anular sin CAE, luego NC ARCA)?