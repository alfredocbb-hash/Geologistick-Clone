## Problema

En **Control de Caja** (`src/pages/Cash.tsx`) las tarjetas de totales solo muestran:
- Monto Inicial
- Ingresos (total)
- Egresos (total)
- Efectivo Esperado (solo efectivo)
- Cantidad de Movimientos

No hay desglose por método de pago, así que el total movido por **Transferencia** (y otros métodos como MercadoPago, tarjeta) no se ve a simple vista, aunque los datos sí existen en cada movimiento (`metodo_pago`).

## Solución

Extender el cálculo de totales para desglosar por método de pago y agregar una tarjeta/sección que muestre el total de Transferencias (y otros métodos relevantes).

### Cambios en `src/pages/Cash.tsx`

1. **Ampliar el reduce de `totals`** (líneas 455-468) para acumular por método de pago:
   - `ingresosTransferencia`, `egresosTransferencia`
   - `ingresosTarjeta`, `egresosTarjeta`
   - `ingresosMercadoPago`, `egresosMercadoPago`
   - Mantener `ingresosEfectivo` / `egresosEfectivo` actuales.

2. **Agregar una fila de tarjetas "Totales por método de pago"** debajo del grid de stats actual (línea ~578), mostrando para cada método el neto (ingresos − egresos) con su ícono y color. Solo mostrar los métodos con monto distinto de 0 para no saturar.

   Ejemplo de tarjeta Transferencias:
   ```
   Transferencias
   +$XX.XXX  (neto)
   Ingresos: +$X · Egresos: -$X
   ```

3. **Mantener** el cálculo de "Efectivo Esperado" igual (sigue siendo solo efectivo, que es lo que realmente debe estar en la caja física).

### Sin cambios en

- Lógica de apertura/cierre de caja.
- Modelo de datos ni queries.
- Otros prints o reportes.

## QA

- Crear movimientos de ingreso y egreso con método "transferencia" y verificar que aparece la tarjeta con el total correcto.
- Verificar que con método efectivo, el "Efectivo Esperado" sigue calculándose igual que hoy.
- Verificar que si no hay movimientos de cierto método, la tarjeta no se renderiza.