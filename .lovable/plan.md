

## Plan: Incluir envíos de terciarizados en liquidaciones de sellers

### Problema
Cuando un envío se carga desde el planificador con cuenta corriente de un seller (ej: Correo Argentino), se registra un cargo en `seller_cuenta_corriente` con `envio_id`, pero el envío no aparece en la liquidación porque:
1. No tiene registro en `ecommerce_orders`
2. Puede no tener `remitente_id` = `cliente_id` del seller

### Solución
Agregar una **tercera fuente de envíos** en el cálculo de liquidaciones: buscar envíos referenciados en `seller_cuenta_corriente` (tipo `cargo`, con `envio_id` no nulo) que no estén ya incluidos desde las otras dos fuentes.

### Cambios en `src/pages/ecommerce/Settlements.tsx`

**En `calculateMutation` (~línea 514, después del bloque de envíos comunes):**

1. Consultar `seller_cuenta_corriente` para obtener `envio_id` de registros tipo `cargo` de los sellers seleccionados, filtrados por fecha y sin liquidación previa
2. Excluir los `envio_id` ya encontrados por ecommerce_orders y envíos comunes
3. Fetch los envíos restantes desde `envios` donde `liquidacion_seller_id IS NULL`
4. Agregar al mapa `envioToSellerMap` usando el `seller_id` del movimiento
5. Combinar con los otros envíos en el merge final (bloque 5)

**En la query de balances (`sellerBalances`, ~línea 153):**

1. Agregar una consulta similar: obtener `envio_id` de `seller_cuenta_corriente` tipo `cargo` por seller
2. Incluir esos envíos en el cálculo de saldo cuando no estén ya cubiertos por ecommerce_orders o remitente_id

### Resumen de archivos

| Archivo | Acción |
|---------|--------|
| `src/pages/ecommerce/Settlements.tsx` | Agregar tercera fuente de envíos en `calculateMutation` y en `sellerBalances` |

No se requieren cambios de base de datos ni nuevas tablas.

