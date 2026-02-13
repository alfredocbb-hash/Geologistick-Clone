

# Fix: Saldos por Seller no coinciden con precios de tarifa

## Problema

La pestaña "Saldos por Seller" muestra el campo `saldo_cuenta_corriente` directo de la base de datos. Este saldo se alimenta de los cargos registrados en `seller_cuenta_corriente`, pero:

1. Muchos envios de ML llegan con `precio_total = $0` y NO se les registra cargo (la edge function solo crea cargo cuando `precioTotal > 0`)
2. Algunos envios se registraron antes de implementar la logica de tarifa por zona
3. Resultado: PABLO GAUNA tiene 6 envios pero solo 2 cargos en su cuenta corriente

Por eso el saldo mostrado ($38,108.96) no refleja lo que realmente deberia cobrar la empresa basandose en la tarifa asignada.

## Solucion

Recalcular el saldo mostrado en la pestaña "Saldos por Seller" usando la misma logica de tarifa que usa la pestaña de Liquidaciones. En vez de mostrar solo `saldo_cuenta_corriente`, calcular:

- **Total Envios**: Suma de todos los envios del seller, con precios recalculados por tarifa
- **Total Pagos**: Suma de pagos registrados en cuenta corriente
- **Saldo Real**: Total Envios - Total Pagos

## Cambios en `src/pages/ecommerce/Settlements.tsx`

### 1. Nuevo query para obtener envios por seller con precios recalculados

Agregar un query que cargue los envios de cada seller (via `ecommerce_orders`) y aplique la logica de tarifa para calcular los totales reales.

### 2. Nuevo query para obtener pagos por seller

Cargar los pagos de `seller_cuenta_corriente` de tipo 'pago' agrupados por seller.

### 3. Actualizar la tabla "Saldos por Seller"

Agregar columnas:
- **Total Envios (tarifa)**: Precio total recalculado usando tarifa asignada
- **Total Pagos**: Pagos registrados
- **Saldo Calculado**: Diferencia entre envios y pagos

Esto reemplaza o complementa el `saldo_cuenta_corriente` para que coincida con lo que calcula la pestaña de Liquidaciones.

### 4. Flujo de calculo

```text
Para cada seller:
1. Buscar envios via ecommerce_orders + envios comunes
2. Para cada envio:
   - Si seller tiene tarifa_id asignada:
     - Si tipo_tarifa = 'zona': match por ciudad_entrega
     - Si no: usar precio_base de la tarifa
   - Si no tiene tarifa: usar precio_total del envio
3. Sumar todos los precios recalculados = Total Envios
4. Buscar pagos en seller_cuenta_corriente tipo 'pago'
5. Saldo Real = Total Envios - Total Pagos
```

### 5. Detalle tecnico de implementacion

- Reutilizar la logica de tarifa existente (normalize, zone matching, fallback)
- Extraerla a una funcion auxiliar para no duplicar codigo
- Cargar tarifas y zonas una sola vez para todos los sellers
- Mostrar tanto el saldo de cuenta corriente (DB) como el saldo calculado (tarifa) para comparacion

| Columna | Fuente |
|---|---|
| Seller | `ecommerce_sellers.nombre` |
| Envios | Cantidad de envios vinculados |
| Total (tarifa) | Suma recalculada por tarifa |
| Pagos | Suma de pagos en cta cte |
| Saldo | Total tarifa - Pagos |
| Acciones | Registrar Pago |

