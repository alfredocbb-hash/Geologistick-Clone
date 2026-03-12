

# Fix: Rol "Emisión" incorrecto para envíos recepcionados en liquidación de sucursal

## Problema

En `BranchSettlements.tsx` línea 598, la determinación del rol solo considera `sucursal_destino_id`:

```typescript
const esDestino = envio.sucursal_destino_id === selectedSucursal;
const rol = esDestino && !esOrigen ? 'recepcion' : 'emision';
```

El envío ENV-RFVNU8 tiene `sucursal_destino_id = NULL` y `sucursal_entrega_id = Mar del Plata`. Como `esDestino` es `false`, el rol queda como `'emision'` cuando debería ser `'recepcion'`.

## Solución

### `src/pages/BranchSettlements.tsx` (línea 597-598)

Incluir `sucursal_entrega_id` en la evaluación:

```typescript
const esDestino = envio.sucursal_destino_id === selectedSucursal 
  || envio.sucursal_entrega_id === selectedSucursal;
const rol = esDestino && !esOrigen ? 'recepcion' : 'emision';
```

Esto asegura que cualquier envío donde la sucursal es el punto de entrega físico se marque correctamente como "Recepción".

| Archivo | Cambio |
|---------|--------|
| `src/pages/BranchSettlements.tsx` | Agregar check de `sucursal_entrega_id` en determinación de rol |

