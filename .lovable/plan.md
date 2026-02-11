
# Liquidaciones de Sellers: Envios Comunes + Cuenta Corriente + Facturacion

## Contexto Actual

Hoy las liquidaciones de sellers solo toman movimientos de la tabla `seller_cuenta_corriente` (cargos, pagos, ajustes). Pero los sellers tambien tienen envios comunes (tabla `envios`) vinculados a traves de `ecommerce_sellers.cliente_id` -> `envios.remitente_id`. Estos envios no se incluyen en la liquidacion.

Ademas, no existe opcion de emitir factura sobre una liquidacion.

## Solucion

### 1. Incluir envios comunes del seller en la liquidacion

Al calcular una liquidacion, ademas de los movimientos de `seller_cuenta_corriente`, tambien se buscaran los envios de la tabla `envios` donde:
- `remitente_id` = `ecommerce_sellers.cliente_id` (el seller esta vinculado a un cliente)
- `created_at` este dentro del rango de fechas
- El envio no haya sido liquidado previamente

Para esto se necesita:
- Agregar columna `liquidacion_seller_id` a la tabla `envios` para marcar envios ya liquidados
- Al calcular, consultar ambas fuentes: movimientos de cuenta corriente + envios sin liquidar
- Mostrar ambos en la vista previa y en el detalle

### 2. Modificar la logica de calculo en Settlements.tsx

El boton "Calcular" hara dos consultas:
1. Movimientos de `seller_cuenta_corriente` sin liquidar en el periodo (como hoy)
2. Envios de `envios` donde `remitente_id = seller.cliente_id`, dentro del periodo, sin `liquidacion_seller_id`

Se mostrara un resumen unificado con tabs: "Movimientos Cta. Cte." y "Envios" para que el operador vea todo antes de generar.

### 3. Al generar la liquidacion

- Vincular movimientos de `seller_cuenta_corriente` con `liquidacion_id` (como hoy)
- Vincular envios con `liquidacion_seller_id`
- Sumar el total de envios al total de cargos de la liquidacion

### 4. Agregar posibilidad de facturar la liquidacion

Agregar columna `factura_id` a `liquidaciones_seller` para vincular con una factura. En el detalle de la liquidacion y en la lista, agregar boton "Facturar" que abre el dialogo `InvoiceDataDialog` existente (adaptado) para emitir factura por el monto total de la liquidacion.

Como la factura actual esta vinculada a un `envio_id`, se necesita:
- Hacer `envio_id` nullable en `facturas` (ya lo es)
- Agregar columna `liquidacion_seller_id` a `facturas` para vincular factura con liquidacion

### 5. Actualizar el detalle de liquidacion

En `SellerLiquidacionDetailDialog`, agregar:
- Tab "Envios" mostrando los envios incluidos en la liquidacion
- Boton "Facturar" que abre el dialogo de facturacion
- Si ya tiene factura, mostrar los datos de la factura emitida

## Cambios por componente

| Componente | Cambio |
|------------|--------|
| **Base de datos** | Agregar `liquidacion_seller_id` a `envios`, agregar `liquidacion_seller_id` a `facturas`, agregar `factura_id` a `liquidaciones_seller` |
| **`src/pages/ecommerce/Settlements.tsx`** | Modificar calculo para incluir envios del seller, mostrar envios en preview, vincular envios al generar |
| **`src/components/ecommerce/SellerLiquidacionDetailDialog.tsx`** | Agregar tab "Envios", boton "Facturar", mostrar datos de factura |
| **Edge function `arca-factura`** | Permitir recibir `liquidacion_seller_id` en vez de `envio_id` para emitir factura por liquidacion |

## Detalle tecnico de la migracion SQL

```text
1. ALTER TABLE envios ADD COLUMN liquidacion_seller_id UUID REFERENCES liquidaciones_seller(id)
2. ALTER TABLE facturas ADD COLUMN liquidacion_seller_id UUID REFERENCES liquidaciones_seller(id)
3. ALTER TABLE liquidaciones_seller ADD COLUMN factura_id UUID REFERENCES facturas(id)
4. CREATE INDEX en envios(liquidacion_seller_id)
5. CREATE INDEX en facturas(liquidacion_seller_id)
```

## Flujo del usuario

```text
1. Operador selecciona seller y rango de fechas
2. Click "Calcular"
3. Sistema muestra:
   - Movimientos de cuenta corriente (cargos/pagos/ajustes)
   - Envios comunes del seller en el periodo
   - Totales unificados
4. Click "Generar Liquidacion"
5. Se crea la liquidacion vinculando todo
6. En el historial, puede:
   - Ver detalle (con tabs Resumen / Movimientos / Envios)
   - Facturar (abre dialogo de datos fiscales)
   - Aprobar / Pagar / Cancelar (como hoy)
   - Descargar PDF (actualizado con envios)
```

## Sin cambios en el portal del seller
El portal del seller (`SellerDashboard`, `SellerShipments`, etc.) seguira funcionando igual, solo vera la liquidacion ya generada.
