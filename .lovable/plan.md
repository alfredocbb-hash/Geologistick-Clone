

## Limpieza de pedidos anteriores al 09/02/2026

### Datos a eliminar

Solo existen **2 pedidos** anteriores al 09-02-2026 (del 3 y 4 de febrero). Cada uno tiene:
- 1 registro en `ecommerce_orders`
- 1 registro en `envios` (vinculado)
- 1 registro en `seller_cuenta_corriente` (cargo asociado)

Los 1602 pedidos restantes son del 09/02 en adelante y se mantienen intactos.

### Orden de eliminacion

Para respetar las dependencias entre tablas, se eliminan en este orden:

1. **seller_cuenta_corriente** - Eliminar los cargos vinculados a esos envios
2. **envio_historial** - Eliminar historial de esos envios
3. **ecommerce_orders** - Eliminar los 2 pedidos
4. **envios** - Eliminar los 2 envios asociados

### Detalle tecnico

Se ejecutaran queries DELETE usando los IDs de los 2 envios vinculados:
- Envio 1: `d8eb0684-f60c-4e26-96b3-a3474bac5390`
- Envio 2: `3da241a8-3525-4041-afb7-f29eb3756c88`

Y los 2 pedidos:
- Pedido 1: `bad114c8-d4b0-49a3-8457-6014e8b2780f`
- Pedido 2: `c1e34a9d-f20c-4ab6-8248-7ea67a4cb8ab`

### Sobre la sincronizacion futura

Tambien se aplicara el filtro de fecha en `mercadolibre-sync` para que solo traiga pedidos recientes (ultimos 7 dias), evitando que se vuelvan a sincronizar pedidos viejos. Este cambio ya estaba aprobado en el plan anterior.

### Sin cambios en la estructura de la base de datos ni en el codigo frontend.

