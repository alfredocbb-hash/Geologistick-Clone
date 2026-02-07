
# Mejoras en Integracion Mercado Pago para Choferes y Webhooks

## Estado actual

La configuracion de Beraexpress esta correcta (tokens `APP_USR-` y `TEST-` con longitudes validas). Sin embargo, hay tres problemas a resolver:

1. **El chofer no tiene opcion de cobrar con Mercado Pago** al entregar un envio COD. Solo puede cobrar en efectivo.
2. **No se genera QR real** — la API de Preferences genera un link de pago, pero no QR nativo. Se puede generar un QR con la URL del link.
3. **El webhook podria no estar procesando correctamente** — hay un pago de prueba en estado "pendiente" desde hace un dia sin actualizacion.

## Plan de cambios

### 1. Agregar opcion de Mercado Pago al flujo de entrega del chofer

**Archivo**: `src/components/delivery/DeliveryConfirmation.tsx`

Actualmente el chofer solo ve un campo de monto y se registra siempre como "efectivo". Modificar para:

- Agregar un selector de metodo de pago (Efectivo / Mercado Pago / Transferencia) antes del campo de monto
- Si elige Mercado Pago:
  - Llamar a la edge function `mercadopago-payment` para generar un link de pago
  - Mostrar un **codigo QR** generado con la libreria `qrcode.react` (ya instalada en el proyecto) que codifica la URL del `init_point`
  - Mostrar tambien un boton para compartir/abrir el link directamente
  - El chofer le muestra el QR al destinatario para que lo escanee con la app de MP
  - El pago queda registrado como "pendiente" y el webhook de MP lo actualizara cuando se complete
- Si elige Efectivo o Transferencia: comportamiento actual (registrar con `register_cod_payment`)

### 2. Generar QR a partir del link de pago

**Archivo**: `src/components/shipments/PaymentMethodDialog.tsx`

En el dialogo de pago usado desde sucursal, tambien agregar un QR visual usando `qrcode.react` con la URL del `init_point`, ademas del boton de abrir link. Asi el operador puede mostrarle el QR al cliente en pantalla.

### 3. Mejorar validaciones en la edge function

**Archivo**: `supabase/functions/mercadopago-payment/index.ts`

- Validar formato del access_token antes de llamar a la API de MP (debe empezar con `APP_USR-` o `TEST-`)
- Parseo defensivo de la respuesta de MP (verificar Content-Type antes de parsear JSON)
- Devolver codigos de error especificos: `MP_INVALID_TOKEN`, `MP_UNAUTHORIZED`, `MP_API_ERROR`
- Logging mejorado: status code de MP, longitud del token (sin exponer el valor)

### 4. Mejorar el webhook para mayor robustez

**Archivo**: `supabase/functions/mercadopago-webhook/index.ts`

- Agregar logging mas detallado para diagnosticar por que no se procesan pagos
- Parseo defensivo de la respuesta de MP al consultar el pago
- Buscar pagos tanto por `mercado_pago_id` exacto como por `preference_id` (actualmente el pago se guarda con el `preference_id` en `mercado_pago_id`, pero el webhook recibe el `payment_id` real de MP que es diferente)

**Problema clave**: Cuando se crea el pago en `mercadopago-payment`, se guarda `preference.id` como `mercado_pago_id`. Pero el webhook recibe `body.data.id` que es el **payment ID** de MP (no el preference ID). El webhook intenta buscar por `mercado_pago_id = paymentId`, pero ese ID nunca va a coincidir porque guardamos el preference ID, no el payment ID. **Este es el bug principal por el cual los pagos no se actualizan.**

Solucion: cambiar la busqueda del webhook para que, cuando no encuentre por `mercado_pago_id`, busque tambien pagos pendientes cuyo `mercado_pago_id` sea un preference ID y use el `external_reference` (envio_id) del pago de MP para hacer match.

## Resumen de archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/delivery/DeliveryConfirmation.tsx` | Agregar selector de metodo de pago con opcion MP, generar QR con link |
| `src/components/shipments/PaymentMethodDialog.tsx` | Agregar QR visual del link de pago, manejar codigos de error |
| `supabase/functions/mercadopago-payment/index.ts` | Validacion de token, parseo defensivo, codigos de error |
| `supabase/functions/mercadopago-webhook/index.ts` | Corregir busqueda de pagos (preference_id vs payment_id), mejor logging |

## Detalle tecnico del flujo QR para el chofer

```text
Chofer confirma entrega COD
  -> Selecciona "Mercado Pago"
  -> Se llama a mercadopago-payment con envio_id y monto
  -> Edge function crea preference en MP y devuelve init_point
  -> Se genera QR con qrcode.react usando la URL init_point
  -> El destinatario escanea el QR y paga en MP
  -> MP envia webhook a mercadopago-webhook
  -> Webhook actualiza el pago de "pendiente" a "pagado"
  -> Chofer puede confirmar la entrega (el pago queda registrado)
```

## Nota sobre el bug del webhook

El flujo actual tiene una desconexion:

```text
mercadopago-payment guarda: mercado_pago_id = "816196571-f30810e1-..." (preference_id)
MP webhook envia:          data.id = "12345678" (payment_id)
webhook busca:             pagos WHERE mercado_pago_id = "12345678" -> NO ENCUENTRA
```

La solucion es que el webhook, al no encontrar por `mercado_pago_id`, consulte el pago en la API de MP para obtener el `external_reference` (que es el `envio_id`), y luego busque el pago pendiente por `envio_id + metodo = mercado_pago`.
