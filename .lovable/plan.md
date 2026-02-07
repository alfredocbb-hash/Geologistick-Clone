
# Fix: Cancelar Pago Mercado Pago vuelve a seleccion de metodo

## Problema detectado

Cuando se crea un envio con pago "contado", el flujo actual es:

1. Se crea el envio en la base de datos
2. Se abre el dialogo de metodo de pago
3. El usuario selecciona Mercado Pago y genera un link/QR
4. Si el usuario presiona "Cancelar", el dialogo se cierra y redirige a la etiqueta

El problema tiene dos partes:

- **El boton "Cancelar" cierra todo el dialogo** en vez de volver a la pantalla de seleccion de metodo de pago. El usuario no puede cambiar de opinion y elegir otro metodo (ej: efectivo).
- **La preferencia de Mercado Pago queda activa** (pendiente) en la base de datos aunque el usuario la cancelo.

## Solucion

### 1. Boton "Cancelar" en la vista del QR vuelve a la seleccion de metodo

Cuando el QR de Mercado Pago esta visible y el usuario presiona "Cancelar":
- Se limpia el estado del QR/preferencia (`mpPayment = null`)
- Se vuelve a mostrar la lista de metodos de pago
- El usuario puede elegir otro metodo (efectivo, transferencia, etc.)

### 2. Marcar la preferencia de MP como cancelada en la base de datos

Al cancelar el QR, se actualiza el registro en la tabla `pagos` para que quede con estado `cancelado`, evitando que un pago tardio por esa preferencia cause confusion.

### 3. Boton "Volver" separado del boton "Cancelar Envio"

Se distinguen dos acciones:
- **"Cambiar metodo"**: vuelve a la seleccion de metodo de pago (no cierra el dialogo)
- **"Cancelar"** (en la vista de seleccion): cierra el dialogo y redirige a la etiqueta sin metodo de pago registrado

## Cambios tecnicos

### Archivo: `src/components/shipments/PaymentMethodDialog.tsx`

- Agregar una funcion `handleCancelMpPayment` que:
  - Actualiza el pago en la tabla `pagos` a estado `cancelado` (si existe un registro con `mercado_pago_id` = `preference_id`)
  - Limpia el estado `mpPayment` y `isWaitingForPayment`
  - Vuelve a mostrar la pantalla de seleccion de metodo
- En la vista del QR, reemplazar el boton "Cancelar" por dos botones:
  - "Cambiar metodo de pago": ejecuta `handleCancelMpPayment` (vuelve a la seleccion)
  - "Confirmar Pago": confirma que el pago se completo (comportamiento actual)

### Archivo: `src/pages/NewShipment.tsx`

- Sin cambios necesarios (el comportamiento de cierre del dialogo sigue igual)

### Resultado esperado

```text
Flujo actual (con bug):
  Seleccionar MP -> Generar QR -> Cancelar -> Cierra dialogo (envio sin pago, preferencia activa)

Flujo corregido:
  Seleccionar MP -> Generar QR -> "Cambiar metodo" -> Vuelve a seleccion de metodo
                                                     -> Marca preferencia MP como cancelada
                                                     -> Puede elegir Efectivo u otro metodo
```
