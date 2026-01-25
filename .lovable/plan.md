

# Plan: Edge Functions para Tiendanube

## Resumen

Implementar tres edge functions para integrar Tiendanube con el sistema logistico:
1. **OAuth Callback** - Para conectar tiendas de sellers
2. **Webhook** - Para recibir pedidos automaticamente
3. **Sync Manual** - Para sincronizar pedidos bajo demanda

## Arquitectura de la Integracion

```text
                     Tiendanube
                          |
         +----------------+----------------+
         |                |                |
    OAuth Flow       Webhooks         API Sync
         |                |                |
         v                v                v
  tiendanube-oauth  tiendanube-webhook  tiendanube-sync
         |                |                |
         +--------> ecommerce_sellers <----+
                          |
                          v
                   ecommerce_orders
```

---

## Edge Function 1: tiendanube-oauth

### Proposito
Manejar el flujo OAuth cuando un seller conecta su tienda de Tiendanube.

### Endpoints
- `GET /authorize?seller_id={uuid}` - Redirige al usuario a Tiendanube
- `GET /callback?code={code}&state={seller_id}` - Recibe el token y lo guarda

### Flujo Detallado

1. **Iniciar conexion** (desde el admin panel):
   - El admin hace clic en "Conectar Tiendanube" en el seller
   - Frontend llama a `/authorize?seller_id=xxx`
   - Edge function genera URL de autorizacion y redirige

2. **Callback de Tiendanube**:
   - Usuario autoriza la app en Tiendanube
   - Tiendanube redirige a `/callback?code=xxx&state=seller_id`
   - Edge function intercambia `code` por `access_token`
   - Guarda `access_token`, `store_id` en `ecommerce_sellers`
   - Registra webhook automaticamente en la tienda
   - Redirige al usuario de vuelta al panel

### Datos Almacenados en ecommerce_sellers

| Campo | Valor |
|-------|-------|
| access_token | Token OAuth de Tiendanube |
| store_id | ID de la tienda en Tiendanube |
| store_url | URL de la tienda |
| webhook_secret | HMAC secret generado para validar webhooks |
| ultimo_sync | Timestamp de ultima sincronizacion |

---

## Edge Function 2: tiendanube-webhook

### Proposito
Recibir notificaciones en tiempo real cuando se crea o actualiza un pedido.

### Eventos Soportados
- `order/created` - Nuevo pedido
- `order/updated` - Actualizacion de pedido
- `order/paid` - Pedido pagado
- `order/fulfilled` - Pedido despachado
- `order/cancelled` - Pedido cancelado

### Flujo de Procesamiento

1. **Recibir webhook**:
   - Tiendanube envia POST con `store_id`, `event`, `id`
   - Validar firma HMAC en header `x-linkedstore-hmac-sha256`

2. **Identificar seller**:
   - Buscar seller por `store_id` en `ecommerce_sellers`
   - Obtener `tenant_id` del seller

3. **Procesar evento**:
   - Para `order/created` o `order/paid`:
     - Obtener datos completos del pedido via API
     - Insertar/actualizar en `ecommerce_orders`
   - Para otros eventos:
     - Actualizar `order_status` o `payment_status`

4. **Responder rapidamente**:
   - Retornar 200 OK inmediatamente
   - Procesar en background si es necesario

### Seguridad: Validacion HMAC

```typescript
const hmac = createHmac('sha256', seller.webhook_secret);
hmac.update(rawBody);
const calculatedSignature = hmac.digest('hex');
const receivedSignature = req.headers.get('x-linkedstore-hmac-sha256');

if (calculatedSignature !== receivedSignature) {
  return new Response('Invalid signature', { status: 401 });
}
```

---

## Edge Function 3: tiendanube-sync

### Proposito
Sincronizar pedidos manualmente desde el panel de administracion.

### Endpoints
- `POST /` - Sincronizar pedidos de un seller especifico
  - Body: `{ seller_id: uuid, since?: date }`

### Flujo de Sincronizacion

1. **Autenticar request**:
   - Verificar JWT del usuario
   - Verificar que el usuario pertenece al mismo tenant que el seller

2. **Obtener pedidos**:
   - Llamar a API de Tiendanube: `GET /{store_id}/orders`
   - Filtrar por `updated_at_min` si se especifica `since`
   - Paginar hasta obtener todos los pedidos

3. **Procesar cada pedido**:
   - Mapear campos de Tiendanube a `ecommerce_orders`
   - Upsert en base de datos (por `external_order_id`)

4. **Actualizar seller**:
   - Actualizar `ultimo_sync` en `ecommerce_sellers`
   - Retornar resumen: pedidos nuevos, actualizados, errores

### Mapeo de Datos Tiendanube -> ecommerce_orders

| Tiendanube | ecommerce_orders |
|------------|------------------|
| id | external_order_id |
| number | external_order_number |
| status | order_status |
| payment_status | payment_status |
| customer.name | buyer_name |
| customer.email | buyer_email |
| customer.phone | buyer_phone |
| customer.identification | buyer_dni |
| shipping_address.address | shipping_address |
| shipping_address.city | shipping_city |
| shipping_address.province | shipping_province |
| shipping_address.zipcode | shipping_postal_code |
| subtotal | subtotal |
| shipping_cost_owner | shipping_cost |
| total | total |
| products | items (JSON) |

---

## Cambios en Frontend

### 1. Boton "Conectar Tiendanube" en Sellers

En `EditSellerDialog.tsx` o en la tabla de sellers, agregar:
- Boton "Conectar Tiendanube" (visible si `plataforma === 'tiendanube'` y no hay `access_token`)
- Badge "Conectado" con icono verde si ya tiene `access_token`
- Boton "Sincronizar Ahora" para llamar a tiendanube-sync

### 2. Estado de Conexion

Mostrar en la tabla de sellers:
- Icono de estado de conexion (conectado/desconectado)
- Fecha de ultima sincronizacion
- Cantidad de pedidos sincronizados

---

## Configuracion en supabase/config.toml

```toml
[functions.tiendanube-oauth]
verify_jwt = false

[functions.tiendanube-webhook]
verify_jwt = false

[functions.tiendanube-sync]
verify_jwt = false
```

Todas las funciones manejan autenticacion manualmente:
- oauth: No requiere auth (flujo OAuth)
- webhook: Valida via HMAC
- sync: Valida JWT del usuario logueado

---

## Archivos a Crear

| Archivo | Descripcion |
|---------|-------------|
| `supabase/functions/tiendanube-oauth/index.ts` | Flujo OAuth completo |
| `supabase/functions/tiendanube-webhook/index.ts` | Receptor de webhooks |
| `supabase/functions/tiendanube-sync/index.ts` | Sincronizacion manual |

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/config.toml` | Agregar configuracion de las 3 funciones |
| `src/pages/ecommerce/Sellers.tsx` | Agregar boton de conexion y sync |
| `src/components/ecommerce/EditSellerDialog.tsx` | Mostrar estado de conexion |

---

## URLs de las Edge Functions

Las URLs finales seran:
- OAuth: `https://uhlgimnmfifmrxraorrl.supabase.co/functions/v1/tiendanube-oauth`
- Webhook: `https://uhlgimnmfifmrxraorrl.supabase.co/functions/v1/tiendanube-webhook`
- Sync: `https://uhlgimnmfifmrxraorrl.supabase.co/functions/v1/tiendanube-sync`

---

## Flujo de Usuario Completo

```text
1. Admin configura Tiendanube en Integraciones
   -> Ingresa client_id y client_secret

2. Admin crea seller con plataforma "Tiendanube"
   -> Guarda datos basicos del seller

3. Admin hace clic en "Conectar Tiendanube"
   -> Redirige a Tiendanube para autorizar
   -> Seller de Tiendanube acepta permisos
   -> Callback guarda tokens y registra webhook

4. Nuevo pedido en Tiendanube
   -> Tiendanube envia webhook
   -> Sistema valida y guarda en ecommerce_orders

5. Admin puede sincronizar manualmente
   -> Clic en "Sincronizar"
   -> Sistema obtiene pedidos recientes via API
```

---

## Orden de Implementacion

1. **tiendanube-oauth** - Base del flujo de conexion
2. **tiendanube-webhook** - Recepcion automatica de pedidos
3. **tiendanube-sync** - Sincronizacion manual
4. **UI Updates** - Botones de conexion y estado
5. **Testing** - Probar flujo completo con tienda de prueba

---

## Consideraciones de Seguridad

- Los `access_token` se almacenan encriptados en la base de datos
- Los webhooks se validan con HMAC-SHA256
- Cada seller tiene su propio `webhook_secret` unico
- Las funciones de sync requieren autenticacion del usuario
- Los datos estan aislados por `tenant_id`

