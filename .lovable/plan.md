

# Totalizador de pedidos seleccionados + Sincronizacion masiva de tiendas

## 1. Totalizador en Pedidos (Orders.tsx)

Cuando el usuario selecciona pedidos (individual o por grupo), mostrar una barra resumen fija con:

- Cantidad de pedidos seleccionados
- Suma total de "Costo Envio" de los seleccionados
- Cantidad con envio creado vs sin envio
- Los botones existentes de "Crear Envios" y "Enviar al Planificador" se mueven a esta barra

La barra aparecera entre los filtros y la tabla (o como sticky en la parte inferior) cuando `selectedOrders.length > 0`.

**Archivo: `src/pages/ecommerce/Orders.tsx`**

- Calcular totales a partir de `filteredOrders` filtrados por `selectedOrders`:
  - `totalShippingCost`: suma de `shipping_cost` de los seleccionados
  - `withShipment`: cantidad con `envio_id`
  - `withoutShipment`: cantidad sin `envio_id`
- Renderizar una Card/barra con estos datos y los botones de accion

## 2. Boton "Sincronizar Todas" en Sellers (Sellers.tsx)

Agregar un boton en el header de la pagina de Sellers que sincronice todas las tiendas activas con conexion (access_token + store_id) de forma secuencial.

**Archivo: `src/pages/ecommerce/Sellers.tsx`**

- Agregar un boton "Sincronizar Todas" junto al boton "Agregar Seller"
- Al hacer clic, iterar sobre los sellers activos que esten conectados
- Para cada uno, invocar la edge function correspondiente segun plataforma (`mercadolibre-sync` o `tiendanube-sync`)
- Mostrar progreso: "Sincronizando 2/5..."
- Al finalizar, mostrar resumen total con toast
- Agregar estado `isBulkSyncing` y `bulkSyncProgress` para controlar la UI

---

## Seccion tecnica

| Archivo | Cambio |
|---|---|
| `src/pages/ecommerce/Orders.tsx` | Agregar barra totalizadora con suma de shipping_cost, conteos, y botones cuando hay seleccion |
| `src/pages/ecommerce/Sellers.tsx` | Agregar boton "Sincronizar Todas" con logica secuencial por plataforma y progreso visual |

### Detalle del totalizador

```text
+---------------------------------------------------------------+
| 12 seleccionados | Envio: $15.400 | 8 con envio | 4 sin envio |
|                          [Crear Envios] [Planificar]           |
+---------------------------------------------------------------+
```

### Detalle de la sincronizacion masiva

```text
Para cada seller en sellers.filter(activo && connected):
  si plataforma === 'mercadolibre' -> invoke mercadolibre-sync
  si plataforma === 'tiendanube'   -> invoke tiendanube-sync
  actualizar progreso (n/total)
  esperar resultado antes de continuar al siguiente
Mostrar toast resumen final
```
