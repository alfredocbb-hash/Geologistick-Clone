
# Sincronización de Sellers como Clientes con Cuenta Corriente

## Diagnóstico del problema

Actualmente existen **dos registros de saldo separados e independientes** para el mismo concepto financiero:

| Donde | Tabla | Movimientos en |
|---|---|---|
| Módulo ecommerce | `ecommerce_sellers.saldo_cuenta_corriente` | `seller_cuenta_corriente` |
| Envíos manuales | `clientes.saldo_cuenta_corriente` | `cliente_cuenta_corriente` |

Esto genera que:
- Al crear un envío manual para un seller, el cargo va a `clientes` (si tiene cta cte habilitada allí)
- Al registrar una liquidación, el pago va a `seller_cuenta_corriente`
- Los dos saldos **nunca se cruzan**, quedando el seller con saldo inflado en `ecommerce_sellers` y el cliente sin reflejo de los pagos recibidos

### Sellers afectados con cliente vinculado pero sin cta cte habilitada en clientes:
- FULLIMPORT, RADIKAL, SANABRIA GABRIEL, SANABRIA LAUTARO, SANABRIA SEBASTIAN, SANABRIA EMANUEL (límite=0)

### El flujo correcto que se busca:
Cuando se crea un envío manual para un seller → el cargo debe ir SOLO a `seller_cuenta_corriente` (no a `cliente_cuenta_corriente`). Cuando se paga una liquidación → reduce `seller_cuenta_corriente`. Todo en un solo lugar.

## Solución en tres capas

### Capa 1: Sincronización retroactiva en base de datos (SQL)

**Paso A — Habilitar cuenta corriente en `clientes` para todos los sellers que la tienen activa:**
```sql
UPDATE clientes c
SET 
  tiene_cuenta_corriente = true,
  limite_credito = GREATEST(c.limite_credito, es.limite_credito),
  updated_at = NOW()
FROM ecommerce_sellers es
WHERE es.cliente_id = c.id
  AND es.tiene_cuenta_corriente = true
  AND (c.tiene_cuenta_corriente = false OR c.limite_credito < es.limite_credito);
```

**Paso B — Sincronizar saldo de `clientes` con el saldo real de `ecommerce_sellers`:**
Para los sellers que ya tienen movimientos en `seller_cuenta_corriente`, el saldo correcto está en `ecommerce_sellers`. El saldo en `clientes` debe reflejar lo mismo para que los envíos manuales sean consistentes.

Sin embargo, dado que los envíos manuales registran sus movimientos en `cliente_cuenta_corriente` y los de ecommerce en `seller_cuenta_corriente`, la solución más limpia es **mantener los dos sistemas separados** pero **hacer que el nuevo envío cargue en `seller_cuenta_corriente` cuando el remitente es un seller**.

### Capa 2: Cambio en el formulario de Nuevo Envío

En `src/pages/NewShipment.tsx`, cuando se selecciona un remitente que es seller (tiene `cliente_id` vinculado a un `ecommerce_seller`), el cargo de cuenta corriente debe:
- Registrar en `seller_cuenta_corriente` (en lugar de `cliente_cuenta_corriente`)
- Actualizar `ecommerce_sellers.saldo_cuenta_corriente` (en lugar de `clientes.saldo_cuenta_corriente`)

Para esto se necesita:
1. Al cargar los clientes con cta cte, también identificar si ese cliente es un seller (join con `ecommerce_sellers` por `cliente_id`)
2. Si es seller, usar el saldo de `ecommerce_sellers` para mostrarlo en el selector
3. Al crear el envío con tipo `cuenta_corriente` y el remitente es seller → insertar en `seller_cuenta_corriente` y actualizar `ecommerce_sellers.saldo_cuenta_corriente`

### Capa 3: Corrección retroactiva de datos

Se necesita una migración SQL que sincronice los saldos actuales correctamente:

1. Para los sellers con `cliente_id` vinculado y movimientos mezclados:
   - El saldo definitivo debe ser el de `ecommerce_sellers` (que es el que refleja liquidaciones)
   - Actualizar `clientes.saldo_cuenta_corriente` para que coincida

2. Habilitar `tiene_cuenta_corriente = true` en `clientes` para todos los sellers que lo tienen activo

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| Migración SQL | Habilitar cta cte en clientes vinculados a sellers + sincronizar límites de crédito |
| `src/pages/NewShipment.tsx` | Al detectar que el remitente-cliente es un seller, cargar en `seller_cuenta_corriente` |
| `src/pages/ClientSettlements.tsx` | Mostrar sellers (detectados vía `ecommerce_sellers`) en el historial de movimientos, unificando `seller_cuenta_corriente` + `cliente_cuenta_corriente` |

## Detalle técnico del cambio en NewShipment

En la query de clientes con cuenta corriente (usada para el selector y el autodetect del remitente), agregar un join con `ecommerce_sellers`:

```typescript
const { data: clientes } = await supabase
  .from('clientes')
  .select(`
    *,
    ecommerce_seller:ecommerce_sellers!ecommerce_sellers_cliente_id_fkey(
      id, saldo_cuenta_corriente, limite_credito, tiene_cuenta_corriente
    )
  `)
  .eq('tiene_cuenta_corriente', true)
  .eq('tenant_id', tenantId);
```

Cuando el remitente seleccionado tiene un `ecommerce_seller` vinculado:
- Mostrar el saldo de `ecommerce_sellers.saldo_cuenta_corriente` (no `clientes.saldo_cuenta_corriente`)
- Al crear el envío, insertar en `seller_cuenta_corriente` y actualizar `ecommerce_sellers`

## Resultado esperado

- Un seller que llega a la ventanilla a despachar un envío manual → el operador lo busca, aparece con su saldo correcto de cuenta corriente (el unificado del módulo ecommerce)
- El cargo queda registrado en `seller_cuenta_corriente`, visible en el módulo de liquidaciones
- Al generar la próxima liquidación, ese envío manual ya queda incluido (porque el motor de liquidaciones ya une ambos sistemas por `seller_id` y `remitente_id`)
- Los saldos en la pantalla de "Saldos por Seller" son consistentes con lo que ve el operador en el mostrador

## Plan de ejecución

1. Migración SQL: habilitar cta cte en clientes vinculados a sellers
2. Modificar `NewShipment.tsx`: detectar si el cliente-remitente es seller y cargar en `seller_cuenta_corriente`
3. Modificar `ClientSettlements.tsx`: incluir sellers en el listado y unificar vista de movimientos
