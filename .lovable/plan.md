

## Plan: Actualizar envíos de KINGDOM VINTAGE a entregado

### Contexto
- Seller: **KINGDOM VINTAGE** (ID: `482c8c28-5afd-4a44-8df4-bf80dd1438ec`)
- **47 envíos** pendientes/en_reparto que deben pasar a `entregado`

### Cambios (sin modificar código, solo datos)

1. **Actualizar estado de los 47 envíos** a `entregado` y setear `fecha_entrega = now()` en la tabla `envios`
2. **Insertar registros en `envio_historial`** para cada envío con la nota "Marcado como entregado por administrador (actualización masiva)"
3. Las órdenes de ecommerce se actualizarán automáticamente por el trigger `sync_ecommerce_order_status` que ya existe

### Ejecución
Se usará el insert tool para ejecutar dos queries:
- `UPDATE envios SET estado = 'entregado', fecha_entrega = now() WHERE id IN (SELECT e.id FROM envios e JOIN ecommerce_orders eo ON eo.envio_id = e.id WHERE eo.seller_id = '482c8c28-...' AND e.estado NOT IN ('entregado','cancelado','devuelto'))`
- `INSERT INTO envio_historial` para los 47 registros

