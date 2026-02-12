
# Fix: Total Cobrado muestra $0 en Liquidacion a Sucursales

## Problemas encontrados

### 1. Mapeo incorrecto de "cuenta_corriente"
En la linea 272, el codigo compara `tipoPago === 'cta_cte'` pero la base de datos almacena el valor `'cuenta_corriente'`. Esto hace que todos los envios de cuenta corriente caigan en el bucket "Contado" de las comisiones y usen los porcentajes de contado en vez de los de cta. cte.

### 2. Total Cobrado usa precio_total en vez de la suma real de conceptos
El calculo de `totalCobrado` (lineas 437-446) usa `envio.precio_total`, que para los envios ML es siempre $0. Ademas, solo suma envios contado (como origen) y destino (como destino entregado), excluyendo cuenta corriente. El total deberia reflejar la suma de las ventas reales (montos de conceptos/detalles).

## Datos de la base de datos (Beraexpress, Feb 2026)

| Tipo | Cantidad | precio_total | Detalles |
|------|----------|-------------|----------|
| ML contado | 68 | $0 c/u | Sin detalles |
| ADMIN cuenta_corriente | 10 | $7,500-$12,600 | Algunos con detalles |
| ADMIN destino | 3 | $1-$12,600 | Con detalles |

## Solucion

| Archivo | Cambio |
|---------|--------|
| `src/pages/BranchSettlements.tsx` | 1. Corregir mapeo de tipo_pago para reconocer 'cuenta_corriente' como 'cta_cte' |
| `src/pages/BranchSettlements.tsx` | 2. Acumular totalCobrado desde los montos reales de conceptos procesados (no de precio_total) |

## Detalle tecnico

### Fix 1: Mapeo de tipo_pago (linea 272 y 456)
```typescript
// Antes
const tipoKey = tipoPago === 'cta_cte' ? 'cta_cte' : tipoPago === 'destino' ? 'destino' : 'contado';

// Despues
const tipoKey = (tipoPago === 'cta_cte' || tipoPago === 'cuenta_corriente') ? 'cta_cte' : tipoPago === 'destino' ? 'destino' : 'contado';
```

### Fix 2: Total Cobrado basado en ventas reales
Reemplazar la logica actual de totalCobrado (lineas 437-446) que usa `envio.precio_total` por una acumulacion dentro de `calcularComisionConcepto` que suma los montos reales de cada concepto procesado:

```typescript
// Agregar acumulador dentro de calcularComisionConcepto
totalCobrado += monto; // El parametro monto ya es el valor real del concepto
```

Y eliminar la logica separada de cobrado que usaba `envio.precio_total`.

La logica de remitos cancelados (destino entregado en sucursal) se mantiene pero usando la suma de montos de detalles o precio_total como fallback.

## Resultado esperado

- Total Cobrado mostrara la suma real de todas las ventas procesadas (todos los conceptos de todos los envios)
- Las comisiones de cuenta corriente apareceran en su propia pestana "Cta. Cte." en vez de en "Contado"
- Los porcentajes de cta. cte. se aplicaran correctamente
- El saldo a transferir se calculara correctamente como totalCobrado - totalComisiones
