

# Fix: Envíos con $0 en liquidaciones de seller (Beraexpress)

## Problema raíz

El webhook de MercadoLibre crea envíos con `precio_total: 0` y `precio_tarifa_vigente: 0` cuando el seller no tiene `tarifa_id` asignado (la mayoría de sellers en Beraexpress). El cálculo de precio solo se hace si `seller.tiene_cuenta_corriente && seller.tarifa_id`, pero como la mayoría no tiene tarifa asignada, quedan en $0.

Hay **170 envíos no liquidados** del 06/03 al 11/03 con precio $0 que deberían usar las tarifas **anteriores** al cambio del 12/03. Los envíos del 12/03 en adelante (~74) también tienen $0 pero deberían usar las tarifas **nuevas**.

### Precios de referencia (verificados desde liquidaciones existentes)

| Zona | Ciudades | Precio viejo (pre-12/03) | Precio nuevo (12/03+) |
|------|---------|--------------------------|----------------------|
| Z1 | Berazategui, Hudson, Ranelagh, etc. | $4,610.88 | $4,490 |
| Z2 | Quilmes, Florencio Varela | $7,370.99 | $6,490 |
| Z3 | CABA y GBA | $10,245.99 | $8,490 |
| Z4 | La Plata, City Bell, etc. | $10,245.99 | $10,245.99 |

## Cambios

### 1. Data fix — Backfill envíos con $0 (SQL UPDATE via insert tool)

Actualizar `precio_tarifa_vigente` y `precio_total` para envíos no liquidados con $0 del tenant Beraexpress:

- **Envíos del 06/03 al 11/03**: match `ciudad_entrega` contra zonas → aplicar precio **viejo**
- **Envíos del 12/03 en adelante**: match `ciudad_entrega` contra zonas → aplicar precio **nuevo** (actual)

Se usa la misma lógica de normalización de ciudades que ya tienen las zonas configuradas en `tarifas.zona_destino`.

### 2. ML Webhook — Calcular precio por zona al crear envío

En `supabase/functions/mercadolibre-webhook/index.ts`, cuando el seller no tiene `tarifa_id`, buscar las tarifas de tipo `zona` activas del tenant y hacer match por `ciudad_entrega` para calcular el precio. Esto previene que futuros envíos de ML se creen con $0.

Cambio en la sección de creación del envío (líneas ~260-308): si `!seller.tarifa_id`, cargar tarifas de zona del tenant, buscar match por ciudad, y usar ese precio.

### 3. Actualizar `precio_total` y `precio_tarifa_vigente` en el envío creado

Ya se hace cuando hay `tarifa_id` (línea 302). Extender la lógica para que también funcione con el precio de zona calculado.

| Archivo | Cambio |
|---------|--------|
| SQL data update | Backfill 170+ envíos pre-12/03 con precios viejos, ~74 envíos post-12/03 con precios nuevos |
| `mercadolibre-webhook/index.ts` | Calcular precio por zona cuando seller no tiene tarifa_id |

