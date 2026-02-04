
# Plan: Corrección de Captura del Importe de Envío ML

## Causa Raíz

El código actual busca el costo de envío en campos que **no existen** en la respuesta del API de MercadoLibre:
- `shipping_option.cost` (no existe)
- `cost` (no existe en la raíz)
- `base_cost` (no existe)
- `shipping_cost.receiver` (puede existir pero no contiene el flete)

Según la documentación oficial de ML, el costo del envío viene en:
- **`lead_time.cost`** - Costo del envío en la estructura correcta

---

## Cambios Necesarios

### 1. Función `register-ml-shipment` (registro por QR)

**Archivo**: `supabase/functions/register-ml-shipment/index.ts`

| Linea | Problema | Solución |
|-------|----------|----------|
| 72-76 | Usa `key`/`value` (incorrecto) | Cambiar a `config_key`/`config_value` |
| 78 | Mapeo con campos incorrectos | Usar nombres de columnas correctos |
| 146-149 | Busca cost en campos incorrectos | Buscar en `lead_time.cost` |

**Código corregido**:
```typescript
// Líneas 72-78: Credenciales
const { data: credentials } = await supabase
  .from('system_integrations')
  .select('config_key, config_value')
  .eq('tenant_id', seller.tenant_id)
  .eq('integration_type', 'mercadolibre')
  .in('config_key', ['client_id', 'client_secret']);

const credMap = Object.fromEntries(
  (credentials || []).map(c => [c.config_key, c.config_value])
);

// Líneas 146-149: Costo del envío
const mlShippingCost = mlShipment.lead_time?.cost 
  || mlShipment.shipping_option?.cost 
  || mlShipment.cost 
  || mlShipment.base_cost 
  || 0;

console.log('[register-ml-shipment] ML shipping cost from lead_time:', mlShippingCost);
console.log('[register-ml-shipment] Full lead_time:', JSON.stringify(mlShipment.lead_time));
```

### 2. Función `mercadolibre-sync` (sincronización masiva)

**Archivo**: `supabase/functions/mercadolibre-sync/index.ts`

Agregar extracción del costo de ML y guardarlo en el campo `precio_flete_ml`:

```typescript
// Después de obtener shipment (línea 162), extraer costo
const mlShippingCost = shipment.lead_time?.cost 
  || shipment.shipping_option?.cost 
  || 0;

console.log('[ML Sync] ML shipping cost:', mlShippingCost);

// Al crear envio (línea 229-255), agregar:
{
  // ... otros campos existentes
  precio_flete_ml: mlShippingCost, // <-- AGREGAR
}
```

---

## Sección Técnica

### Estructura de respuesta API MercadoLibre (`/shipments/{id}`)

```json
{
  "id": 46399291666,
  "status": "ready_to_ship",
  "logistic_type": "self_service",
  "lead_time": {
    "option_id": 123456,
    "shipping_method": {
      "id": 509245,
      "type": "next_day",
      "name": "Envío a domicilio"
    },
    "currency_id": "ARS",
    "cost": 2500.00,         // <-- AQUÍ ESTÁ EL COSTO
    "cost_type": "charged"
  },
  "receiver_address": { ... }
}
```

### Campos probados (orden de prioridad)

1. `lead_time.cost` - Campo principal según documentación
2. `shipping_option.cost` - Posible alternativa en algunos países
3. `cost` - Fallback en caso de estructura distinta
4. `base_cost` - Último fallback

### Logging adicional

Se agregará logging detallado de la estructura `lead_time` para depurar futuras discrepancias en la respuesta del API.

---

## Resumen de Archivos

| Archivo | Cambios |
|---------|---------|
| `supabase/functions/register-ml-shipment/index.ts` | Corregir credenciales y extraer `lead_time.cost` |
| `supabase/functions/mercadolibre-sync/index.ts` | Extraer `lead_time.cost` y guardar en `precio_flete_ml` |
