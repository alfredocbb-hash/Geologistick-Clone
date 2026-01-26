
# Plan: Personalizar Nombre de Empresa en Tiendanube Checkout

## Objetivo
En lugar de mostrar "Geologistick" genérico, mostrar el nombre de la empresa del tenant (ej: "Beraexpress") cuando los compradores ven las opciones de envío en Tiendanube.

## Contexto

Actualmente hay dos lugares donde está hardcodeado "Geologistick":

| Ubicación | Línea | Valor Actual |
|-----------|-------|--------------|
| `tiendanube-shipping-rates` | 117 | `"Geologistick - Envío Estándar"` |
| `tiendanube-oauth` | 273 | `"Geologistick"` (registro de carrier) |

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/tiendanube-shipping-rates/index.ts` | Obtener `nombre_app` de `tenant_branding` y usarlo en la respuesta |
| `supabase/functions/tiendanube-oauth/index.ts` | Obtener nombre del tenant al registrar el carrier |

---

## Cambios Técnicos

### 1. Modificar `tiendanube-shipping-rates`

**Agregar tenant_id al query del seller (línea 37):**
```typescript
.select("id, nombre, tarifa_id, min_delivery_days, max_delivery_days, activo, tenant_id")
```

**Obtener branding del tenant (después de validar seller):**
```typescript
// Get tenant branding for company name
const { data: branding } = await supabase
  .from("tenant_branding")
  .select("nombre_app")
  .eq("tenant_id", seller.tenant_id)
  .maybeSingle();

const companyName = branding?.nombre_app || "Envío Express";
```

**Usar nombre dinámico en la respuesta (línea 117):**
```typescript
const rates = [
  {
    code: "custom_shipping",
    name: `${companyName} - Envío Estándar`,  // ← Dinámico
    price: precio.toFixed(2),
    currency: "ARS",
    min_delivery_days: seller.min_delivery_days || 3,
    max_delivery_days: seller.max_delivery_days || 5,
  }
];
```

### 2. Modificar `tiendanube-oauth`

**Obtener branding antes de registrar carrier (después de línea 252):**
```typescript
// Get tenant branding for carrier name
const { data: branding } = await supabase
  .from("tenant_branding")
  .select("nombre_app")
  .eq("tenant_id", seller.tenant_id)
  .maybeSingle();

const companyName = branding?.nombre_app || "Envío Express";
```

**Usar nombre dinámico al registrar carrier (línea 273):**
```typescript
body: JSON.stringify({
  name: companyName,  // ← Dinámico: "Beraexpress" en vez de "Geologistick"
  callback_url: `${supabaseUrl}/functions/v1/tiendanube-shipping-rates`,
  types: "ship",
  active: true,
}),
```

---

## Resultado Esperado

### Antes
```
○ Geologistick - Envío Estándar - $7,500 (3-5 días)
```

### Después
```
○ Beraexpress - Envío Estándar - $7,500 (3-5 días)
```

---

## Flujo de Datos

```text
Comprador en checkout → Tiendanube llama endpoint
                                ↓
     Edge Function obtiene seller → tenant_id
                                ↓
     Consulta tenant_branding → nombre_app = "Beraexpress"
                                ↓
     Responde: { name: "Beraexpress - Envío Estándar", price: "7500.00" }
                                ↓
     Comprador ve: ○ Beraexpress - Envío Estándar - $7,500
```

---

## Notas

- Si no hay branding configurado, se usa "Envío Express" como fallback genérico
- Los sellers existentes necesitan reconectar su tienda para actualizar el nombre del carrier en Tiendanube
- Las cotizaciones se actualizan automáticamente (cada request trae el nombre fresco)
