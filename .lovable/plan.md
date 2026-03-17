

# Plan: Mostrar destino en envíos sin sucursal destino

## Problema
La columna "Destino" en la tabla de envíos solo muestra `sucursal_destino?.nombre`. Cuando un envío no tiene sucursal destino asignada (entregas puerta a puerta), muestra "-", aunque el envío sí tiene `ciudad_entrega` cargada.

## Cambio

### `src/pages/Shipments.tsx` — línea 523-525

Cambiar el render de la celda "Destino" para mostrar fallbacks:

1. `sucursal_destino?.nombre` (si tiene sucursal destino)
2. `ciudad_entrega` (si tiene ciudad de entrega)
3. `direccion_entrega` truncada (si tiene dirección)
4. "-" como último fallback

```tsx
// Antes:
{envio.sucursal_destino?.nombre || '-'}

// Después:
{envio.sucursal_destino?.nombre || envio.ciudad_entrega || envio.direccion_entrega || '-'}
```

| Archivo | Cambio |
|---------|--------|
| `src/pages/Shipments.tsx` | Agregar fallback `ciudad_entrega` / `direccion_entrega` en columna Destino |

