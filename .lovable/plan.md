
# Fecha de entrega estimada en Pedidos e-Commerce

## Problema

Los pedidos e-commerce se muestran con la fecha de creacion (`created_at`), que es la fecha en que el comprador hizo la compra. Pero los pedidos que entran despues de las 12:00 hs se entregan al dia siguiente, y el sistema deberia reflejar eso.

Actualmente la tabla `ecommerce_orders` no tiene un campo de fecha de entrega estimada.

## Solucion

### 1. Agregar columna `fecha_entrega_estimada` a la tabla `ecommerce_orders`

Nueva columna de tipo `date` que se calcula automaticamente:
- Si el pedido se crea antes de las 12:00 (hora Argentina, UTC-3) -> fecha de entrega = hoy
- Si el pedido se crea despues de las 12:00 -> fecha de entrega = dia siguiente

### 2. Trigger para calcular automaticamente la fecha

Un trigger `BEFORE INSERT` que calcule `fecha_entrega_estimada` basandose en la hora de creacion en zona horaria Argentina (`America/Argentina/Buenos_Aires`).

```text
Si hora local >= 12:00
  fecha_entrega_estimada = mañana
Sino
  fecha_entrega_estimada = hoy
```

### 3. Actualizar pedidos existentes

Una migracion que llene la columna para los pedidos que ya existen, aplicando la misma logica sobre su `created_at`.

### 4. Modificar la pagina de Pedidos e-Commerce

En `src/pages/ecommerce/Orders.tsx`:
- Mostrar `fecha_entrega_estimada` en vez de `created_at` en la columna de fecha del pedido
- Filtrar por `fecha_entrega_estimada` en vez de `created_at` para que el filtro de fechas muestre los pedidos segun su fecha de entrega

### 5. Actualizar las Edge Functions que crean pedidos

Agregar el calculo de `fecha_entrega_estimada` en:
- `mercadolibre-webhook/index.ts` (cuando llega un pedido nuevo por webhook)
- `mercadolibre-sync/index.ts` (cuando se sincronizan pedidos)
- `tiendanube-webhook/index.ts` (pedidos de Tiendanube)
- `tiendanube-sync/index.ts` (sync de Tiendanube)
- `register-ml-shipment/index.ts` (registro manual de envio ML)

La logica en las edge functions sera:
```text
hora actual en Argentina (UTC-3)
Si hora >= 12 -> fecha = mañana
Si hora < 12 -> fecha = hoy
```

Nota: El trigger de base de datos es la capa de seguridad principal; las edge functions lo establecen como optimizacion pero el trigger siempre corrige si falta.

### 6. Actualizar CreateShipmentFromOrderDialog

Cuando se crea un envio desde un pedido, copiar la `fecha_entrega_estimada` del pedido al campo `fecha_entrega` del envio.

## Resumen de cambios

| Componente | Cambio |
|------------|--------|
| Base de datos | Nueva columna `fecha_entrega_estimada` + trigger BEFORE INSERT |
| `src/pages/ecommerce/Orders.tsx` | Mostrar y filtrar por `fecha_entrega_estimada` |
| `src/components/ecommerce/CreateShipmentFromOrderDialog.tsx` | Usar `fecha_entrega_estimada` como `fecha_entrega` del envio |
| 5 Edge Functions | Calcular y enviar `fecha_entrega_estimada` al crear pedidos |
