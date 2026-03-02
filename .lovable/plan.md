

# Fix: Facturación de liquidaciones de seller

## Problema

El componente `InvoiceDataDialog` se usa para facturar tanto envíos individuales como liquidaciones de sellers. Sin embargo, solo acepta `envioId` como prop. Cuando se invoca desde `SellerLiquidacionDetailDialog`, se pasa el ID de la liquidacion como `envioId`:

```tsx
<InvoiceDataDialog envioId={liquidacion.id} ... />
```

La edge function `arca-factura` recibe `envio_id` con un UUID que corresponde a una liquidacion, intenta buscarlo en la tabla `envios`, no lo encuentra, y devuelve error.

## Solucion

Agregar soporte para `liquidacion_seller_id` en el `InvoiceDataDialog`.

### 1. `src/components/invoicing/InvoiceDataDialog.tsx`

- Agregar prop opcional `liquidacionSellerId?: string`
- Hacer `envioId` opcional (ya que puede venir uno u otro)
- En la mutacion, enviar `liquidacion_seller_id` en lugar de `envio_id` cuando corresponda:

```typescript
body: {
  envio_id: envioId || undefined,
  liquidacion_seller_id: liquidacionSellerId || undefined,
  tipo_comprobante,
  environment: selectedEnvironment,
  receptor: { ... },
  importe_total: importeTotal,
}
```

### 2. `src/components/ecommerce/SellerLiquidacionDetailDialog.tsx`

- Cambiar la invocacion para usar la prop correcta:

```tsx
<InvoiceDataDialog
  open={invoiceDialogOpen}
  onClose={() => setInvoiceDialogOpen(false)}
  onSuccess={handleInvoiceSuccess}
  liquidacionSellerId={liquidacion.id}
  importeTotal={Math.abs(liquidacion.saldo_periodo || 0)}
/>
```

- Quitar `envioId` de esta invocacion.

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/components/invoicing/InvoiceDataDialog.tsx` | Agregar prop `liquidacionSellerId`, enviar campo correcto a la edge function |
| `src/components/ecommerce/SellerLiquidacionDetailDialog.tsx` | Usar `liquidacionSellerId` en vez de `envioId` |

## Sin cambios de base de datos

La edge function ya soporta `liquidacion_seller_id` -- el problema es solo del frontend que enviaba el campo equivocado.

