
# Usar tarifa asignada del seller para calcular importes en liquidaciones

## Problema

Los importes de los envios que vienen de MercadoLibre no siempre coinciden con lo que la empresa cobra realmente. El campo `precio_total` del envio puede tener valores incorrectos o $0. Actualmente solo se recalcula cuando es $0, pero deberia usarse siempre la tarifa asignada al seller para que los totales de la liquidacion coincidan con los de la vista de pedidos.

## Solucion

Cambiar la logica de calculo para que **siempre** use la tarifa asignada al seller (`tarifa_id` en `ecommerce_sellers`) en vez de `precio_total` del envio. Si el seller no tiene tarifa asignada, se mantiene el precio del envio como fallback.

## Cambios en `src/pages/ecommerce/Settlements.tsx`

### 1. Agregar `tarifa_id` al query de sellers (linea ~151)

Incluir `tarifa_id` en el select para tener acceso a la tarifa asignada de cada seller.

### 2. Actualizar la interface `Seller` (linea ~30)

Agregar `tarifa_id: string | null` al tipo.

### 3. Cambiar logica de precios en `calculateMutation` (lineas ~305-361)

En vez de usar `precio_total` y solo recalcular cuando es $0:

```text
ANTES:
- Usar precio_total del envio
- Solo si es $0, buscar tarifa por zona

DESPUES:
- Buscar la tarifa asignada al seller (tarifa_id)
- Cargar esa tarifa de la tabla 'tarifas'
- Para cada envio, calcular el precio usando precio_base de la tarifa
- Si la tarifa es de tipo 'zona', buscar match por ciudad
- Si no hay tarifa asignada, usar precio_total del envio como fallback
```

### 4. Flujo detallado

1. Obtener los `tarifa_id` unicos de los sellers seleccionados
2. Cargar las tarifas correspondientes de la tabla `tarifas`
3. Si la tarifa es de tipo zona, tambien cargar las tarifas de zona del tenant
4. Para cada envio:
   - Si el seller tiene `tarifa_id` asignado, usar `precio_base` de esa tarifa
   - Si la tarifa es por zona y el envio tiene ciudad, hacer match por zona
   - Si no hay tarifa asignada, usar `precio_total` del envio (fallback)
5. Marcar `precio_calculado = true` cuando se uso la tarifa asignada

Esto alineara los importes de la liquidacion con los que se muestran en la vista de pedidos.
