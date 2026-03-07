

# Fix: "En Sucursal" muestra sucursal incorrecta en tracking

## Problema

En `supabase/functions/public-tracking/index.ts` línea 213:
```typescript
const sucursalActual = sucursalEntrega?.nombre || sucursalDestino?.nombre || null;
```

Esto siempre devuelve la sucursal de destino/entrega. Cuando un envío "sucursal a sucursal" está en estado `en_sucursal` y todavía está en la sucursal de origen (no ha sido despachado), el tracking muestra el nombre de la sucursal destino en vez de la de origen.

## Solución

Cambiar la lógica en `public-tracking/index.ts` línea 213 para determinar `sucursalActual` según el estado del envío:

- Si `estado` es `pendiente`, `recogido`, o `en_sucursal` **y** no hay `sucursal_entrega` registrada → mostrar `sucursal_origen`
- Si `estado` es `en_transito`, `en_reparto` → mostrar `sucursal_destino`  
- Si `estado` es `entregado` y `entregado_en_sucursal` → mostrar `sucursal_entrega` o `sucursal_destino`

Lógica concreta:
```typescript
let sucursalActual: string | null = null;
if (envio.estado === 'en_sucursal' || envio.estado === 'pendiente' || envio.estado === 'recogido') {
  // Package is still at origin unless explicitly delivered to another branch
  sucursalActual = sucursalEntrega?.nombre || sucursalOrigen?.nombre || null;
} else if (envio.estado === 'entregado') {
  sucursalActual = sucursalEntrega?.nombre || sucursalDestino?.nombre || null;
} else {
  // en_transito, en_reparto, etc.
  sucursalActual = sucursalDestino?.nombre || null;
}
```

Esto corrige que cuando Ranelagh ingresa el envío y está "en sucursal", el tracking diga "En Sucursal (Ranelagh)" en vez de mostrar la sucursal destino.

## Archivo a modificar
- `supabase/functions/public-tracking/index.ts` (línea 213)

