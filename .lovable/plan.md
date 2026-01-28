
# Plan: Mejoras de Integración Tiendanube

## Resumen Ejecutivo

Implementar las funcionalidades faltantes para cumplir con los requisitos de Tiendanube y mejorar la experiencia del comprador.

## Análisis de Brechas

| Funcionalidad | Estado Actual | Estado Objetivo |
|---------------|---------------|-----------------|
| Múltiples opciones de envío | Solo 1 tarifa fija | Estándar + Express |
| Puntos de retiro | No implementado | Soporte para pickup |
| Fulfillment sync | No notifica a TN | Notificar cuando se entrega |
| Versión de API | v1 | 2025-03 (opcional) |

## Fase 1: Múltiples Opciones de Envío

### Objetivo
Permitir que el comprador elija entre "Envío Estándar" y "Envío Express" con diferentes precios y tiempos de entrega.

### Cambios Técnicos

**Base de Datos**
Agregar campos a `ecommerce_sellers`:
- `tarifa_express_id` (UUID, nullable) - Tarifa para envío express
- `express_delivery_days` (INTEGER, default 1) - Días de entrega express
- `express_surcharge` (NUMERIC, default 0) - Recargo adicional para express

**Edge Function `tiendanube-shipping-rates`**

Lógica actual:
```text
rates = [
  { code: "custom_shipping", name: "Envío Estándar", price: X }
]
```

Nueva lógica:
```text
rates = [
  { code: "standard_shipping", name: "Envío Estándar", price: X, days: 3-5 },
  { code: "express_shipping", name: "Envío Express", price: X+recargo, days: 1 }
]
```

### Flujo de Datos

```text
Tiendanube solicita tarifas
         ↓
tiendanube-shipping-rates recibe peso/destino
         ↓
Calcula tarifa estándar usando tarifa_id
         ↓
¿Seller tiene tarifa_express_id?
    ├─ Sí → Calcula tarifa express + recargo
    └─ No → Solo devuelve tarifa estándar
         ↓
Retorna array con 1 o 2 opciones
```

## Fase 2: Puntos de Retiro (Pickup)

### Objetivo
Permitir al comprador retirar en sucursales del operador logístico.

### Cambios Técnicos

**Base de Datos**
Agregar a `ecommerce_sellers`:
- `permite_pickup` (BOOLEAN, default false)
- `pickup_surcharge` (NUMERIC, default 0) - Descuento o recargo

**Consultar Sucursales Activas**
```sql
SELECT id, nombre, direccion, ciudad, codigo_postal, latitud, longitud
FROM sucursales
WHERE tenant_id = seller.tenant_id
AND activa = true
AND permite_retiro_clientes = true
```

**Edge Function `tiendanube-shipping-rates`**

Nuevo tipo de respuesta para pickup:
```json
{
  "rates": [
    {
      "code": "standard_shipping",
      "name": "Envío Estándar",
      "price": "1500.00",
      "type": "ship"
    },
    {
      "code": "pickup_branch_123",
      "name": "Retiro en Sucursal Centro",
      "price": "500.00",
      "type": "pickup",
      "address": "Av. Corrientes 1234",
      "city": "CABA",
      "province": "Buenos Aires"
    }
  ]
}
```

### Migración de Sucursales
Agregar campo a `sucursales`:
- `permite_retiro_clientes` (BOOLEAN, default false)

## Fase 3: Sincronización de Fulfillment

### Objetivo
Cuando un envío se marca como "entregado" en el sistema, notificar automáticamente a Tiendanube.

### Cambios Técnicos

**Nueva Edge Function: `tiendanube-fulfill`**

Endpoint que recibe:
```json
{
  "envio_id": "uuid",
  "tracking_url": "https://geologic.lovable.app/tracking/ABC123"
}
```

Llama a la API de Tiendanube:
```text
POST /v1/{store_id}/orders/{order_id}/fulfill

{
  "shipping_tracking_number": "ABC123",
  "shipping_tracking_url": "https://...",
  "notify_customer": true
}
```

**Trigger de Base de Datos**

```sql
CREATE OR REPLACE FUNCTION notify_tiendanube_fulfillment()
RETURNS trigger AS $$
BEGIN
  IF NEW.estado = 'entregado' AND OLD.estado != 'entregado' THEN
    -- Verificar si el envío tiene orden de ecommerce
    PERFORM pg_notify('tiendanube_fulfill', json_build_object(
      'envio_id', NEW.id
    )::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Flujo de Datos

```text
Chofer marca envío como "entregado"
         ↓
Trigger detecta cambio de estado
         ↓
Busca si envío tiene ecommerce_order asociado
         ↓
¿Tiene orden de Tiendanube?
    ├─ Sí → Llama API fulfill de TN
    │       → Actualiza fulfillment_status en ecommerce_orders
    └─ No → No hace nada
         ↓
Comprador recibe email de TN con tracking
```

### Alternativa sin Trigger
Modificar `DeliveryConfirmation.tsx` para llamar a la función de fulfill después de confirmar la entrega:

```typescript
// Después de actualizar estado a 'entregado'
const { data: ecommerceOrder } = await supabase
  .from('ecommerce_orders')
  .select('id, external_order_id, seller:ecommerce_sellers(store_id, access_token)')
  .eq('envio_id', shipment.id)
  .maybeSingle();

if (ecommerceOrder) {
  await supabase.functions.invoke('tiendanube-fulfill', {
    body: { envio_id: shipment.id }
  });
}
```

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/` | Agregar campos a ecommerce_sellers y sucursales |
| `supabase/functions/tiendanube-shipping-rates/index.ts` | Múltiples tarifas + pickup |
| `supabase/functions/tiendanube-fulfill/index.ts` | **NUEVO** - Notificar fulfillment |
| `src/components/delivery/DeliveryConfirmation.tsx` | Llamar fulfill tras entrega |
| `src/pages/ecommerce/Sellers.tsx` | UI para configurar express y pickup |
| `src/components/ecommerce/EditSellerDialog.tsx` | Campos para nuevas opciones |

## Prioridades Recomendadas

1. **Alta**: Fulfillment Sync - Mejora la experiencia del comprador
2. **Media**: Múltiples opciones de envío - Aumenta conversión
3. **Baja**: Puntos de retiro - Requiere más infraestructura

## Estimación de Complejidad

| Fase | Complejidad | Tiempo Estimado |
|------|-------------|-----------------|
| Múltiples opciones | Baja | 1-2 horas |
| Puntos de retiro | Media | 2-3 horas |
| Fulfillment sync | Media | 2 horas |
| **Total** | | **5-7 horas** |

## Preguntas para Definir

1. ¿Implementar las 3 fases o priorizar alguna?
2. ¿El recargo express es un porcentaje o monto fijo?
3. ¿Todas las sucursales pueden ser puntos de retiro?
4. ¿Notificar al comprador vía TN cuando se entrega?
