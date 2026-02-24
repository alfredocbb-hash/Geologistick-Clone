

# Fix: Envios de e-commerce en estado pendiente no aparecen en el Planificador

## Problema

En `src/pages/RoutePlanner.tsx` (linea 264-268), hay un filtro que excluye todos los envios vinculados a pedidos de e-commerce cuando estan en estado `pendiente`. Esto es correcto para envios que requieren retiro previo (el chofer debe ir a buscarlos al seller), pero incorrecto para envios que NO requieren retiro y estan listos para planificar la entrega directamente.

El envio de Ada Marina Perez fue creado desde un pedido de e-commerce, esta en estado `pendiente`, no requiere retiro, y por lo tanto deberia aparecer en el planificador.

## Solucion

Agregar una condicion al filtro: si el envio de e-commerce NO tiene `requiere_retiro = true`, permitir que aparezca en el planificador aunque este en estado `pendiente`.

## Cambio tecnico

En `src/pages/RoutePlanner.tsx`, linea 264-268, modificar el filtro:

```typescript
// Antes:
const filtered = merged.filter(envio =>
  !ecommerceEnvioIds.has(envio.id) || 
  urlEnvioIds.has(envio.id) || 
  ['recogido', 'en_sucursal', 'en_reparto'].includes(envio.estado || '') ||
  (envio.reprogramado_count && envio.reprogramado_count > 0)
);

// Despues:
const filtered = merged.filter(envio =>
  !ecommerceEnvioIds.has(envio.id) || 
  urlEnvioIds.has(envio.id) || 
  ['recogido', 'en_sucursal', 'en_reparto'].includes(envio.estado || '') ||
  (envio.reprogramado_count && envio.reprogramado_count > 0) ||
  !envio.requiere_retiro
);
```

La logica queda:
- Si NO es de e-commerce: aparece (sin cambios)
- Si es de e-commerce Y viene por URL: aparece (sin cambios)
- Si es de e-commerce Y esta recogido/en_sucursal/en_reparto: aparece (sin cambios)
- Si es de e-commerce Y fue reprogramado: aparece (sin cambios)
- **NUEVO:** Si es de e-commerce Y NO requiere retiro: aparece (listo para planificar entrega)
- Si es de e-commerce Y requiere retiro Y esta pendiente: NO aparece (debe ser retirado primero)

## Archivo a modificar

| Archivo | Cambio |
|---|---|
| `src/pages/RoutePlanner.tsx` | Agregar `!envio.requiere_retiro` al filtro de e-commerce (linea 268) |

