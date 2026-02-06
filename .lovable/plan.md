
# Mejora de Validacion y Manejo de Errores en Mercado Pago Payment

## Problema Detectado

La empresa **Beraexpress** cargo como `access_token` de Mercado Pago el valor `427014809579968` (15 caracteres, numerico). Esto es un **User ID o numero de cuenta**, no un access token. Los tokens validos de Mercado Pago tienen formato:
- **Sandbox**: `TEST-1234567890123456-MMDDYY-hash-userId` (~60+ caracteres)
- **Produccion**: `APP_USR-1234567890123456-MMDDYY-hash-userId` (~60+ caracteres)

## Solucion

### 1. Mejorar la Edge Function `mercadopago-payment`

Agregar validaciones y mejor manejo de errores:

- **Validar formato del token** antes de enviar a la API de MP. Si el token no empieza con `APP_USR-` o `TEST-`, devolver un error descriptivo indicando que el token es invalido.
- **Parseo defensivo de la respuesta** de MP: verificar `Content-Type` antes de parsear como JSON, ya que MP puede devolver HTML en caso de errores de autenticacion.
- **Logging mejorado**: registrar el status code de MP, la longitud del token (sin exponer el valor), y el cuerpo del error completo para facilitar el soporte tecnico.
- **Mensaje de error claro para el usuario**: en lugar de "Error al crear preferencia de pago", indicar que el access token podria ser invalido y que contacte al administrador para revisarlo.

### 2. Mejorar el componente PaymentMethodDialog

- Cuando la respuesta del backend incluya detalles del error de MP (como `UNAUTHORIZED`), mostrar un toast mas descriptivo sugiriendo revisar la configuracion del access token.

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/mercadopago-payment/index.ts` | Validacion de formato de token, parseo defensivo de respuesta MP, mejor logging |
| `src/components/shipments/PaymentMethodDialog.tsx` | Mejor manejo de errores especificos de MP |

## Accion Manual Requerida

Beraexpress necesita corregir su `access_token` en la configuracion de Mercado Pago. El token correcto se obtiene desde el panel de desarrolladores de Mercado Pago:
1. Ir a https://www.mercadopago.com.ar/developers/panel/app
2. Seleccionar la aplicacion
3. Copiar el **Access Token** (no el User ID ni el Public Key)
4. Para sandbox: usar el token de "Credenciales de prueba"
5. Para produccion: usar el token de "Credenciales de produccion"

