

# Corregir Envios Flex que no aparecen en Liquidacion

## Problema detectado

Hay **dos problemas** por los cuales los envios Flex no aparecen al calcular la liquidacion de PABLO GAUNA (Beraexpress):

### Problema 1: Envios sin `remitente_id`
De los 63 envios ML Flex de febrero, **50 tienen `remitente_id = NULL`**. Esto ocurre porque cuando se sincronizaron, el seller aun no tenia `cliente_id` vinculado. La liquidacion busca `envios.remitente_id = seller.cliente_id`, asi que estos envios quedan invisibles.

### Problema 2: Multiples sellers, un solo cliente
Beraexpress tiene **6 sellers** (PABLO GAUNA, GAUNA ZARATE NICOLAS, BEATRIZ GAUNA, GAUNA MIA ABIGAIL, GAUNA BENJAMIN, CARLOS JAVIER GONZALEZ) todos vinculados al mismo `cliente_id`. Al seleccionar "PABLO GAUNA" solo se buscan los envios de ese seller individual, pero los envios de los otros 5 sellers no se incluyen.

## Solucion

### 1. Corregir envios existentes con `remitente_id = NULL`

Ejecutar una migracion que actualice los envios ML sin remitente, usando la relacion `ecommerce_orders.ml_shipment_id` para encontrar el seller y su `cliente_id`:

```text
UPDATE envios e
SET remitente_id = es.cliente_id
FROM ecommerce_orders eo
JOIN ecommerce_sellers es ON eo.seller_id = es.id
WHERE e.ml_shipment_id = eo.ml_shipment_id
  AND e.remitente_id IS NULL
  AND es.cliente_id IS NOT NULL;
```

### 2. Incluir envios de todos los sellers con el mismo `cliente_id`

Modificar la query de calculo en `Settlements.tsx` para que al seleccionar un seller, se busquen envios por `remitente_id = seller.cliente_id` (que ya es correcto). Como todos los sellers de Beraexpress comparten el mismo `cliente_id`, los envios de todas las cuentas ya se consolidarian automaticamente **una vez corregido el problema 1**.

### 3. Tambien buscar envios via `ecommerce_orders` como fallback

Agregar una segunda consulta que busque envios a traves de la tabla `ecommerce_orders` para capturar cualquier envio que aun tenga `remitente_id = NULL`:

```text
// Ademas de buscar por remitente_id, buscar via ecommerce_orders
// para el seller seleccionado y todos los sellers con mismo cliente_id
```

## Cambios por archivo

| Archivo | Cambio |
|---------|--------|
| Migracion SQL | UPDATE envios con remitente_id NULL usando join con ecommerce_orders y sellers |
| `src/pages/ecommerce/Settlements.tsx` | En calculateMutation: buscar todos los seller_ids con el mismo cliente_id, luego buscar envios tambien via ecommerce_orders como fallback |
| `supabase/functions/mercadolibre-sync/index.ts` | Ya esta correcto (asigna `remitente_id: seller.cliente_id`), no requiere cambios |

## Detalle tecnico

### Migracion SQL

Corrige los ~50 envios existentes sin remitente:

```text
UPDATE envios e
SET remitente_id = es.cliente_id
FROM ecommerce_orders eo
JOIN ecommerce_sellers es ON eo.seller_id = es.id
WHERE e.ml_shipment_id IS NOT NULL
  AND e.ml_shipment_id = eo.ml_shipment_id::bigint
  AND e.remitente_id IS NULL
  AND es.cliente_id IS NOT NULL;
```

### Cambio en Settlements.tsx (calculateMutation)

```text
// Actual:
.eq('remitente_id', seller.cliente_id)

// Nuevo: ademas, buscar via ecommerce_orders para envios sin remitente_id
// 1. Buscar seller_ids que comparten el mismo cliente_id
// 2. Buscar envios via ecommerce_orders para esos sellers
// 3. Combinar ambos resultados (sin duplicados)
```

La logica quedaria:
1. Query principal: `envios WHERE remitente_id = seller.cliente_id` (como hoy)
2. Query complementaria: `envios JOIN ecommerce_orders WHERE seller_id IN (sellers con mismo cliente_id) AND remitente_id IS NULL`
3. Merge ambos resultados por ID unico

## Resultado esperado

- Al calcular liquidacion de PABLO GAUNA, apareceran los envios de TODAS las cuentas ML de Beraexpress
- Los envios que antes tenian remitente NULL quedaran corregidos en la base de datos
- Futuros envios sincronizados ya se crean con remitente_id correcto (ya implementado)

