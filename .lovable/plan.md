

# Fix: Envíos reprogramados de e-commerce no se agregan a "Crear Ruta"

## Problema

Los envíos reprogramados tienen tracking "ML-..." (son pedidos de MercadoLibre/e-commerce). Al reprogramarse, su estado vuelve a `pendiente`. El planificador tiene un filtro que excluye envíos de e-commerce en estado `pendiente` (línea 261 de `RoutePlanner.tsx`):

```typescript
const filtered = merged.filter(envio =>
  !ecommerceEnvioIds.has(envio.id) || 
  urlEnvioIds.has(envio.id) || 
  ['recogido', 'en_sucursal', 'en_reparto'].includes(envio.estado || '')
);
```

Esto hace que los envíos reprogramados de e-commerce sean invisibles en la pestaña "Crear Ruta", aunque sus IDs se agreguen a `selectedEnvios`.

## Solución

Agregar una excepción al filtro: si el envío tiene `reprogramado_count > 0`, no excluirlo aunque sea de e-commerce en estado `pendiente`. Un envío reprogramado ya pasó por el flujo de recolección y debe poder re-asignarse.

## Cambio

| Archivo | Cambio |
|---------|--------|
| `src/pages/RoutePlanner.tsx` | Modificar el filtro de e-commerce (linea 261) para incluir envíos con `reprogramado_count > 0` |

## Detalle técnico

Cambiar el filtro de:

```typescript
const filtered = merged.filter(envio =>
  !ecommerceEnvioIds.has(envio.id) || 
  urlEnvioIds.has(envio.id) || 
  ['recogido', 'en_sucursal', 'en_reparto'].includes(envio.estado || '')
);
```

A:

```typescript
const filtered = merged.filter(envio =>
  !ecommerceEnvioIds.has(envio.id) || 
  urlEnvioIds.has(envio.id) || 
  ['recogido', 'en_sucursal', 'en_reparto'].includes(envio.estado || '') ||
  (envio.reprogramado_count && envio.reprogramado_count > 0)
);
```

## Resultado esperado

Al seleccionar envíos reprogramados de e-commerce y presionar "Agregar a Nueva Ruta", aparecerán correctamente en la pestaña "Crear Ruta" junto con los demás pedidos del día.
