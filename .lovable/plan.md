

# Fix: Filtrar correctamente envios ML "listo para enviar" del planificador

## Problema

El cambio anterior (`!envio.requiere_retiro`) es demasiado amplio. Los envios sincronizados de Mercado Libre no tienen `requiere_retiro` seteado (es null/false), entonces TODOS pasan el filtro, incluyendo los que estan en "listo para enviar" (estado `pendiente`) y no deberian aparecer en el planificador.

Lo que el usuario espera ver:
- El retiro de Ada Marina Perez (creado manualmente desde pedido, sin `ml_shipment_id`)
- Envios "en Camino" (estado `recogido`, `en_reparto`, etc.) - ya cubierto
- **NO** los envios ML en "listo para enviar" (tienen `ml_shipment_id`, estado `pendiente`)

## Causa raiz

La diferencia entre el envio de Ada Marina Perez y los envios ML auto-sincronizados es que los auto-sincronizados tienen `ml_shipment_id` asignado, mientras que los creados manualmente desde la pagina de pedidos no lo tienen.

## Solucion

Reemplazar la condicion `!envio.requiere_retiro` por `!envio.ml_shipment_id`. Esto permite:

- Envios de e-commerce creados manualmente (sin `ml_shipment_id`): **aparecen**
- Envios ML auto-sincronizados en estado pendiente (con `ml_shipment_id`): **NO aparecen**
- Envios ML en estados avanzados (recogido, en_reparto): **aparecen** (por la condicion de estado que ya existe)
- Retiros con `requiere_retiro = true`: **aparecen** como retiro
- Envios reprogramados: **aparecen** (por la condicion existente)

## Cambio tecnico

En `src/pages/RoutePlanner.tsx`, linea 269, reemplazar:

```typescript
// Antes:
!envio.requiere_retiro

// Despues:
!envio.ml_shipment_id
```

## Archivo a modificar

| Archivo | Cambio |
|---|---|
| `src/pages/RoutePlanner.tsx` | Cambiar condicion de filtro de `!envio.requiere_retiro` a `!envio.ml_shipment_id` (linea 269) |

