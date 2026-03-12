

# Fix: Liquidación de sucursal no incluye envíos recepcionados

## Diagnóstico

El problema está en la query de cálculo de liquidación en `BranchSettlements.tsx`, línea 193:

```
.or(`sucursal_origen_id.eq.${selectedSucursal},sucursal_destino_id.eq.${selectedSucursal}`)
```

Cuando Mar del Plata recibe un envío via hoja de ruta, el campo que se actualiza es `sucursal_entrega_id` (ubicación física actual), **no** `sucursal_destino_id` (destino final del paquete, que puede ser otra ciudad). La query solo busca por `sucursal_origen_id` y `sucursal_destino_id`, por lo que los envíos recepcionados quedan invisibles.

Lo mismo ocurre en la lógica de roles (líneas 382-383):
```tsx
const esOrigen = envio.sucursal_origen_id === selectedSucursal;
const esDestino = envio.sucursal_destino_id === selectedSucursal;
```

Si `sucursal_destino_id` no es Mar del Plata, `esDestino` es `false` y nunca aplica comisiones de recepción.

## Solución

### `src/pages/BranchSettlements.tsx`

1. **Query**: Agregar `sucursal_entrega_id` al filtro OR:
```
.or(`sucursal_origen_id.eq.${selectedSucursal},sucursal_destino_id.eq.${selectedSucursal},sucursal_entrega_id.eq.${selectedSucursal}`)
```

2. **Select**: Agregar `sucursal_entrega_id` a los campos seleccionados.

3. **Lógica de roles**: Considerar `sucursal_entrega_id` como indicador de recepción:
```tsx
const esOrigen = envio.sucursal_origen_id === selectedSucursal;
const esDestino = envio.sucursal_destino_id === selectedSucursal 
  || envio.sucursal_entrega_id === selectedSucursal;
```
Esto asegura que si Mar del Plata es donde se entregó/recepcionó el paquete, se apliquen las comisiones de recepción.

4. **Deduplicación**: Evitar que un envío donde la sucursal es simultáneamente origen y destino/entrega se procese doble (ya existe esta lógica implícitamente al ser condiciones separadas, pero hay que verificar que no se duplique cuando `sucursal_destino_id` y `sucursal_entrega_id` son ambas la misma sucursal seleccionada).

5. **Cobrado de pago destino**: La lógica de `totalCobrado` para pago destino (línea 455) también debe incluir `sucursal_entrega_id`:
```tsx
const esDestinoEntrega = envio.sucursal_destino_id === selectedSucursal 
  || envio.sucursal_entrega_id === selectedSucursal;
```

6. **Return data**: Incluir `sucursal_entrega_id` en el objeto de retorno del envío.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/BranchSettlements.tsx` | Agregar `sucursal_entrega_id` al filtro, select, y lógica de roles |

