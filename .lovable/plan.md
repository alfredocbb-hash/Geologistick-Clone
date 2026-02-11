
## Limpieza masiva de envios ML y filtro de sincronizacion por dia

### Problema actual
- Hay **1,689 envios de ML** en la base de datos, pero solo **14 tienen fecha de entrega de hoy**
- La sincronizacion trae pedidos de los ultimos 7 dias (activos) y 3 dias (resueltos), creando cientos de registros innecesarios
- El usuario solo necesita ver los pedidos que corresponden al dia de entrega actual

### Plan

**Paso 1: Eliminar envios ML que NO son para hoy (1,675 registros)**

Eliminar en orden de dependencias:
1. `ruta_paradas` vinculadas a envios ML con fecha de entrega distinta a hoy
2. `envio_historial` de esos envios
3. `pagos` de esos envios (si hay)
4. `seller_cuenta_corriente` de esos envios
5. `ecommerce_orders` vinculadas a esos envios
6. Los `envios` ML propiamente dichos

Se preservaran los 14 envios con fecha de entrega = 2026-02-11 y todos los envios no-ML.

**Paso 2: Modificar la funcion de sincronizacion (`mercadolibre-sync`)**

Cambiar la logica para que despues de obtener los pedidos de la API de ML, solo procese aquellos cuya fecha de entrega estimada (`shipping_option.estimated_delivery_time.date`) corresponda al dia actual. Los pedidos con fecha de entrega de otros dias seran ignorados.

Cambios concretos en `supabase/functions/mercadolibre-sync/index.ts`:
- Despues de obtener los detalles del shipment via API, extraer la fecha de entrega de `shipment.shipping_option.estimated_delivery_time.date`
- Comparar con la fecha de hoy (zona horaria Argentina, UTC-3)
- Si no coincide, hacer `continue` (saltar ese pedido)
- Esto reduce drasticamente la cantidad de envios creados por sincronizacion

**Paso 3: Actualizar tambien la logica de update de envios existentes**

Para los envios ML que ya existen en la base de datos, el sync actualmente actualiza estados. Mantener esta logica solo para envios que ya estan en el sistema (independientemente de la fecha), pero no crear nuevos envios para fechas pasadas.

### Detalle tecnico

**Base de datos (eliminaciones):**
Se eliminaran ~1,675 envios ML y sus registros asociados (~1,630 ecommerce_orders, ~96 envio_historial, ~19 ruta_paradas).

**Edge Function `mercadolibre-sync/index.ts`:**
- Agregar filtro post-API que valide `shipment.shipping_option.estimated_delivery_time.date`
- Extraer solo la parte de fecha y comparar con `new Date()` en zona horaria Argentina
- Log de pedidos saltados para visibilidad
- Los envios existentes (update path) siguen actualizandose normalmente
