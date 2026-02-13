

# Fix: Total (tarifa) en Saldos por Seller debe usar tarifas por zona

## Problema

Todos los sellers tienen `tarifa_id = null` en la base de datos. El codigo actual solo aplica la logica de tarifa por zona cuando el seller tiene un `tarifa_id` asignado. Como ningun seller lo tiene, el sistema usa `precio_total` del envio como fallback, que para envios de MercadoLibre suele ser $0 o un valor incorrecto.

## Solucion

Cambiar la logica en el query `seller-tariff-balances` para que **siempre** intente hacer matching por zona usando las tarifas de zona del tenant, independientemente de si el seller tiene `tarifa_id` asignado o no.

## Cambios en `src/pages/ecommerce/Settlements.tsx`

### Modificar la carga de tarifas de zona (lineas ~172-194)

Cargar siempre las tarifas de zona del tenant, sin depender de que algun seller tenga `tarifa_id` asignado.

### Modificar el calculo de precio por envio (lineas ~273-303)

Cambiar la logica de:

```text
ANTES:
  Si seller tiene tarifa_id -> usar esa tarifa (zona o base)
  Si no -> usar precio_total del envio

DESPUES:
  Si seller tiene tarifa_id -> usar esa tarifa (zona o base)
  Si no tiene tarifa_id PERO hay tarifas de zona -> hacer match por ciudad_entrega
  Si no hay match -> usar precio_total del envio como fallback
```

Esto es exactamente la misma logica que ya usa el `calculateMutation` de la pestaña Liquidaciones: cuando no hay tarifa asignada, igual intenta matching por zona con la ciudad de entrega del envio.

### Resultado esperado

Los importes en la columna "Total (tarifa)" reflejaran la suma de precios calculados por zona para cada envio del seller, coincidiendo con lo que muestra la vista de pedidos y la pestaña de liquidaciones.
