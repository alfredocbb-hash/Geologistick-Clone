
# Plan: Corregir pagos de Mercado Pago que figuran como pendientes

## Problema detectado

Analice la base de datos y encontre que **todos los pagos de Mercado Pago tienen `mercado_pago_status = null` y `estado = pendiente`**. Tambien verifique que el webhook no tiene ningun log, lo que significa que MercadoPago nunca lo esta llamando (posiblemente por configuracion de la URL de notificacion o porque los pagos son de prueba/sandbox).

Esto causa que aunque el cliente pague, el sistema nunca se entera del cambio de estado.

## Solucion: Boton "Sincronizar" manual + fix del webhook

### 1. Nueva funcion backend: `mercadopago-check-status`

Crear una funcion que dado un `pago_id` interno:
- Lee el registro de `pagos` para obtener el `mercado_pago_id` (preference ID)
- Usa el access token del tenant para consultar la API de MP: `GET /checkout/preferences/{id}` para obtener los pagos asociados
- Alternativamente, busca pagos por `external_reference` (envio_id) usando `GET /v1/payments/search?external_reference={envio_id}`
- Actualiza el registro con el estado real del pago

### 2. Boton "Verificar Estado" en la UI

En la pestaña "Mercado Pago" de la pagina de Pagos, agregar:
- Un boton global "Sincronizar todos" que verifique el estado de todos los pagos pendientes de MP
- Un boton individual por fila para verificar un pago especifico

### 3. Fix en el webhook existente

Actualmente el webhook consume el body con `req.json()` pero luego intenta usar `req` de nuevo para verificar la firma. Como el body ya fue consumido, esto puede fallar silenciosamente. Ademas, la Strategy 2 itera todos los tenants lo cual es ineficiente.

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `supabase/functions/mercadopago-check-status/index.ts` | **Nuevo** - Funcion para consultar estado de pagos en MP |
| `src/pages/Payments.tsx` | Agregar boton "Sincronizar" en la tab Mercado Pago |
| `supabase/functions/mercadopago-webhook/index.ts` | Fix: clonar request antes de consumir body para que la verificacion de firma funcione |

## Detalle tecnico

### Edge function `mercadopago-check-status`

```
POST /functions/v1/mercadopago-check-status
Body: { pago_id?: string }  // si no se pasa, sincroniza todos los pendientes del tenant
```

Logica:
1. Obtener tenant_id del usuario autenticado
2. Buscar pagos con `metodo = 'mercado_pago'` y `estado = 'pendiente'` del tenant
3. Para cada pago, usar el `envio_id` como `external_reference` y buscar en MP:
   `GET /v1/payments/search?external_reference={envio_id}&sort=date_created&criteria=desc`
4. Si encuentra un pago con status `approved`, actualizar el registro:
   - `estado` -> `pagado`
   - `mercado_pago_status` -> `approved`
   - `mercado_pago_id` -> payment ID real de MP
   - `referencia` -> payment ID

### UI: Boton sincronizar

Se agrega un boton "Sincronizar estados" en el header de la tab Mercado Pago que llama a la edge function y refresca la tabla al completar.

### Fix del webhook

Clonar el body del request al inicio para que tanto el parsing como la verificacion de firma puedan acceder a el:

```typescript
const rawBody = await req.text();
const body = JSON.parse(rawBody);
// usar rawBody tambien para firma si es necesario
```
