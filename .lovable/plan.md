

## Plan: Fix envíos con precio $0 en liquidaciones de choferes

### Problema
En `DriverSettlements.tsx`, al calcular la liquidación, solo se usa `precio_total` del envío. Si el envío tiene `precio_total = 0` (común en envíos de ecommerce o envíos antiguos creados antes de configurar tarifas), el monto aparece como $0. El campo `precio_tarifa_vigente` (precio congelado al momento de crear el envío) no se consulta, y tampoco se hace un fallback por zona para obtener el precio.

Otros módulos de liquidación (ecommerce Settlements) ya implementan la jerarquía de precios correcta: `precio_tarifa_vigente` → `precio_total` → búsqueda por zona.

### Cambios

**`src/pages/DriverSettlements.tsx`**:

1. Agregar `precio_tarifa_vigente` al `selectFields` de la query de envíos.

2. Agregar búsqueda de `precio_base` en las zone tarifas (ya se cargan pero solo para comisiones).

3. Antes de calcular la comisión, resolver el precio efectivo con la jerarquía:
   - Si `precio_tarifa_vigente > 0` → usar ese
   - Si `precio_total > 0` → usar ese
   - Sino → buscar `precio_base` de la zone tarifa que matchea por `ciudad_entrega`

4. Usar el precio efectivo tanto para mostrar en la tabla como para el cálculo de comisión (`calcularComision(precioEfectivo, ...)`).

5. En la interfaz `EnvioParaLiquidar`, agregar un campo `precio_efectivo` que se use en la tabla y en el cálculo de totales, para que el usuario vea el precio real resuelto.

| Archivo | Cambio |
|---------|--------|
| `src/pages/DriverSettlements.tsx` | Jerarquía de precios: `precio_tarifa_vigente` → `precio_total` → zone tarifa `precio_base` |

No se requiere migración de base de datos.

