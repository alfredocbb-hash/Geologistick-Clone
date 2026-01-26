
# Plan: Integración de Shipping Carrier con Tiendanube

## Objetivo
Permitir que los compradores en Tiendanube puedan seleccionar "Geologistick" como opción de envío durante el checkout, mostrando cotizaciones en tiempo real basadas en la tarifa del seller.

## Cómo Funciona la API de Shipping de Tiendanube

### Flujo de Checkout
```text
Comprador agrega productos → Checkout → Ingresa dirección
                                              ↓
                             Tiendanube llama al endpoint de cotización
                                              ↓
                             Geologistick responde con precio + tiempo de entrega
                                              ↓
                             Comprador ve "Geologistick - $X - 3-5 días"
                                              ↓
                             Comprador selecciona Geologistick → Paga
                                              ↓
                             Webhook order/created con carrier_id
```

---

## Archivos a Crear/Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `supabase/functions/tiendanube-shipping-rates/index.ts` | CREAR | Endpoint de cotización para Tiendanube |
| `supabase/functions/tiendanube-oauth/index.ts` | MODIFICAR | Agregar scopes de shipping y registrar carrier |
| `supabase/config.toml` | MODIFICAR | Agregar config para nueva edge function |

---

## Implementación Técnica Detallada

### 1. Nueva Edge Function: `tiendanube-shipping-rates`

Tiendanube llamará a este endpoint para obtener cotizaciones:

**Request de Tiendanube:**
```json
POST /functions/v1/tiendanube-shipping-rates
{
  "store_id": "5406516",
  "destination": {
    "country": "AR",
    "province": "Buenos Aires",
    "city": "Berazategui",
    "zipcode": "1886",
    "address": "Calle 149 A 3727"
  },
  "items": [
    { "product_id": 123, "variant_id": 456, "quantity": 2, "weight": "0.5" }
  ],
  "total": "15000.00"
}
```

**Response esperado:**
```json
{
  "rates": [
    {
      "code": "geologistick_standard",
      "name": "Geologistick - Envío Estándar",
      "price": "7500.00",
      "currency": "ARS",
      "min_delivery_days": 3,
      "max_delivery_days": 5
    }
  ]
}
```

**Lógica de cálculo:**
```typescript
// 1. Buscar seller por store_id
// 2. Obtener tarifa asignada (seller.tarifa_id)
// 3. Calcular precio usando:
//    - precio_base
//    - peso total (sum of items.weight * items.quantity)
//    - conceptos básicos (Entrega a Domicilio)
// 4. Retornar rate con precio y tiempo estimado
```

### 2. Modificar OAuth: Agregar Shipping Scopes

**Scopes adicionales necesarios:**
- `write_shipping` - Para registrar el carrier
- `read_shipping` - Para leer info de envíos

**Registrar Carrier al conectar tienda:**
```typescript
// Después de obtener access_token, registrar carrier
await fetch(`${TIENDANUBE_API_ENDPOINT}/${storeId}/shipping_carriers`, {
  method: "POST",
  headers: {
    "Authentication": `bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "Geologistick",
    callback_url: `${supabaseUrl}/functions/v1/tiendanube-shipping-rates`,
    types: "ship",
    active: true
  }),
});
```

### 3. Configuración del Carrier

**Tabla nueva o campos adicionales (opcional):**
Para mayor flexibilidad, podríamos agregar campos a `ecommerce_sellers`:
- `shipping_carrier_id` - ID del carrier en Tiendanube
- `min_delivery_days` - Días mínimos de entrega
- `max_delivery_days` - Días máximos de entrega

---

## Código de la Edge Function `tiendanube-shipping-rates`

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ rates: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const payload = await req.json();
    console.log("Shipping rate request:", payload);

    const storeId = String(payload.store_id);
    const destination = payload.destination || {};
    const items = payload.items || [];

    // Find seller by store_id
    const { data: seller, error: sellerError } = await supabase
      .from("ecommerce_sellers")
      .select("id, nombre, tarifa_id, min_delivery_days, max_delivery_days")
      .eq("store_id", storeId)
      .single();

    if (sellerError || !seller || !seller.tarifa_id) {
      console.log("Seller not found or no tarifa:", storeId);
      return new Response(
        JSON.stringify({ rates: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tarifa with concepts
    const { data: tarifa } = await supabase
      .from("tarifas")
      .select("id, nombre, precio_base, tipo_tarifa, rangos_precios")
      .eq("id", seller.tarifa_id)
      .single();

    const { data: conceptos } = await supabase
      .from("tarifa_concepto_precios")
      .select("monto, concepto:tarifa_conceptos(codigo, nombre, es_basico)")
      .eq("tarifa_id", seller.tarifa_id);

    // Calculate total weight
    const totalWeight = items.reduce((sum, item) => {
      const weight = parseFloat(item.weight) || 0;
      const qty = parseInt(item.quantity) || 1;
      return sum + (weight * qty);
    }, 0);

    // Calculate price
    let precio = Number(tarifa?.precio_base) || 0;
    
    // Add weight-based calculation if applicable
    if (tarifa?.tipo_tarifa === 'peso' && tarifa?.rangos_precios) {
      const rangos = tarifa.rangos_precios;
      const pesoBaseHasta = rangos.peso_base_hasta || 0;
      const adicionalPorKg = rangos.adicional_por_kg || 0;
      if (totalWeight > pesoBaseHasta) {
        precio += (totalWeight - pesoBaseHasta) * adicionalPorKg;
      }
    }

    // Add basic concepts (like "Entrega a Domicilio")
    const basicConcepts = (conceptos || []).filter(c => c.concepto?.es_basico);
    basicConcepts.forEach(c => {
      precio += Number(c.monto) || 0;
    });

    // Build response
    const rates = [
      {
        code: "geologistick_standard",
        name: "Geologistick - Envío Estándar",
        price: precio.toFixed(2),
        currency: "ARS",
        min_delivery_days: seller.min_delivery_days || 3,
        max_delivery_days: seller.max_delivery_days || 5,
      }
    ];

    console.log("Returning rate:", rates[0]);

    return new Response(
      JSON.stringify({ rates }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error calculating shipping:", error);
    return new Response(
      JSON.stringify({ rates: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

## Modificaciones a OAuth

En `tiendanube-oauth/index.ts`, después de guardar el access_token:

```typescript
// Register shipping carrier
try {
  const carrierResponse = await fetch(
    `${TIENDANUBE_API_ENDPOINT}/${storeId}/shipping_carriers`,
    {
      method: "POST",
      headers: {
        "Authentication": `bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": "Geologistick (alfredocbb@gmail.com)",
      },
      body: JSON.stringify({
        name: "Geologistick",
        callback_url: `${supabaseUrl}/functions/v1/tiendanube-shipping-rates`,
        types: "ship",
        active: true,
      }),
    }
  );
  
  if (carrierResponse.ok) {
    const carrierData = await carrierResponse.json();
    // Guardar carrier_id en seller
    await supabase
      .from("ecommerce_sellers")
      .update({ shipping_carrier_id: String(carrierData.id) })
      .eq("id", sellerId);
    console.log("Shipping carrier registered:", carrierData.id);
  }
} catch (e) {
  console.error("Failed to register shipping carrier:", e);
}
```

---

## Migración de Base de Datos

Agregar campos para configuración de envío:

```sql
ALTER TABLE public.ecommerce_sellers
ADD COLUMN IF NOT EXISTS shipping_carrier_id TEXT,
ADD COLUMN IF NOT EXISTS min_delivery_days INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS max_delivery_days INTEGER DEFAULT 5;
```

---

## Flujo Completo

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           TIENDANUBE CHECKOUT                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Comprador → Ingresa dirección de entrega                              │
│                          ↓                                              │
│   Tiendanube → POST /functions/v1/tiendanube-shipping-rates             │
│                          ↓                                              │
│   Edge Function:                                                        │
│   1. Busca seller por store_id                                          │
│   2. Obtiene tarifa_id del seller                                       │
│   3. Calcula: precio_base + peso + conceptos básicos                    │
│   4. Retorna: { rates: [{ name, price, days }] }                        │
│                          ↓                                              │
│   Comprador ve:  ○ Geologistick - Envío Estándar - $7,500 (3-5 días)    │
│                  ○ Otro Carrier - $X                                     │
│                          ↓                                              │
│   Comprador selecciona Geologistick → Confirma compra                   │
│                          ↓                                              │
│   Webhook order/created → ecommerce_orders → [Crear Envío]              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Requisitos Previos en Tiendanube Partners

Para que el Shipping Carrier funcione, la aplicación en Tiendanube Partners debe tener los scopes:
- `read_orders`
- `write_orders`
- `read_shipping` (NUEVO)
- `write_shipping` (NUEVO)

Esto debe configurarse manualmente en el portal de Tiendanube Partners antes de reconectar las tiendas.

---

## Resultado Esperado

1. Los compradores ven "Geologistick" como opción de envío en el checkout
2. El precio se calcula automáticamente según la tarifa asignada al seller
3. El tiempo de entrega estimado se muestra (configurable por seller)
4. Al completar la compra, el pedido llega con el carrier seleccionado
5. El operador puede crear el envío con toda la información pre-cargada
