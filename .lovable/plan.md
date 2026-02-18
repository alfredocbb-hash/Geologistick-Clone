
# Dos correcciones: PDF profesional con logo + envíos comunes en liquidaciones de sellers

## Problema 1: PDF de liquidaciones sin logo ni diseño profesional

El archivo `src/lib/generateSettlementPDF.ts` genera PDFs básicos. La función `generateSettlementPDF` no acepta datos de branding. Las tres funciones de descarga (`downloadDriverSettlementPDF`, `downloadBranchSettlementPDF`, `downloadSellerSettlementPDF`) no buscan branding. `PrintSettlement.tsx` sí busca branding pero no lo pasa a las funciones.

El patrón de referencia ya existe en `src/lib/generateShipmentReceiptPDF.ts` con `loadImageAsBase64`, `hexToRgb`, y el uso del logo por canvas.

## Problema 2: Envíos comunes no incluidos en liquidaciones de sellers

En `src/pages/ecommerce/Settlements.tsx`, la función `calculateMutation` tiene este problema crítico:

```typescript
// Línea 367
if (uniqueClienteIds.length > 0) {
  // Este bloque solo se ejecuta si el seller tiene cliente_id asignado
  // Si no tiene cliente_id, se salta TODA la lógica de envíos
}
```

**Causas del bug:**
1. Si el seller no tiene `cliente_id`, la variable `uniqueClienteIds` está vacía y el bloque completo es saltado → ningún envío es incluido en el cálculo.
2. Los envíos de MercadoLibre Flex llegan vía `ecommerce_orders` con `seller_id` directo, y sí se cuentan.
3. Los envíos comunes/manuales (ingresados por operadores) usan `remitente_id = cliente_id` del seller, pero si ese `cliente_id` es `null`, quedan fuera.
4. También existe el caso de envíos con `remitente_id = seller.id` (el UUID del seller en `ecommerce_sellers`), que tampoco se buscan.

**Solución para el bug de envíos:**

Refactorizar la lógica de cálculo para que los envíos vía `ecommerce_orders` sean siempre consultados (independientemente de `cliente_id`), y los envíos comunes sean buscados solo cuando el seller tiene `cliente_id`:

```
LÓGICA CORRECTA:
1. Siempre buscar envíos de ecommerce_orders por seller_id → envíos ML Flex y Tiendanube
2. Si el seller tiene cliente_id → adicionalmente buscar envíos manuales por remitente_id
3. Combinar ambos sin duplicados
```

El mismo problema existe en el cálculo de saldos de la pestaña "Saldos por Seller" (`sellerBalances` query, líneas 183-228), que tampoco incluye envíos manuales de sellers sin `cliente_id`.

## Plan de implementación

### Cambio 1: `src/lib/generateSettlementPDF.ts` — Rediseño completo

**Nueva firma de `generateSettlementPDF`:**
```typescript
export async function generateSettlementPDF(
  data: SettlementPDFData,
  branding?: { logo_light?: string | null; nombre_app?: string | null; color_primario?: string | null }
): Promise<void>
```

**Diseño del nuevo PDF:**

```text
┌──────────────────────────────────────────────────────────────────────┐
│  [COLOR PRIMARIO - 28mm alto]                                        │
│  [LOGO 22x22]  NOMBRE EMPRESA         LIQUIDACIÓN DE CHOFER         │
│                                        Período: 01/01 - 31/01/2025  │
├──────────────────────────────────────────────────────────────────────┤
│  Chofer: Juan Pérez          Estado: PAGADA          Fecha: 01/02   │
│  Método de Pago: Transferencia    Referencia: TRF-12345             │
├──────────────────────────────────────────────────────────────────────┤
│  ┌─── RESUMEN FINANCIERO (fondo color primario 10% opacidad) ────┐  │
│  │  Cantidad de Envíos: 45     Total: $207,494.55 (GRANDE/BOLD)  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  DETALLE DE ENVÍOS                                                   │
│  [CABECERA CON FONDO COLOR PRIMARIO - TEXTO BLANCO]                 │
│  Tracking    │  Fecha   │  Destinatario         │  Monto            │
│  [filas alternadas blanco/gris claro]                                │
│  [total al pie de la tabla]                                         │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│  NOMBRE APP  •  Período 01/01/2025 - 31/01/2025  •  Pág. N de M   │
└──────────────────────────────────────────────────────────────────────┘
```

**Helpers a agregar dentro del archivo:**
- `loadImageAsBase64(url)`: misma implementación que en `generateShipmentReceiptPDF.ts` (canvas + crossOrigin)
- `hexToRgb(hex)`: convierte color primario a RGB para jsPDF

**Las tres funciones de descarga** (`downloadDriverSettlementPDF`, `downloadBranchSettlementPDF`, `downloadSellerSettlementPDF`) se actualizan para:
1. Obtener el `tenant_id` del usuario autenticado
2. Buscar `tenant_branding` (solo `logo_light`, `nombre_app`, `color_primario`)
3. Cargar el logo con `loadImageAsBase64`
4. Pasar `branding` a `generateSettlementPDF`

**`PrintSettlement.tsx`**: actualizar `handleDownloadPDF` para pasar el branding ya cargado a las funciones de descarga, evitando una doble consulta.

### Cambio 2: `src/pages/ecommerce/Settlements.tsx` — Corrección del cálculo de envíos

**En `calculateMutation` (función principal de cálculo):**

Refactorizar el flujo para que los envíos de `ecommerce_orders` se busquen siempre, y los envíos comunes solo cuando hay `cliente_id`:

```typescript
// ANTES (incorrecto): Todo dentro de if (uniqueClienteIds.length > 0)
if (uniqueClienteIds.length > 0) {
  // busca ecommerce_orders Y envíos comunes
}

// DESPUÉS (correcto): Separar en dos bloques independientes

// Bloque 1: Siempre buscar envíos de ecommerce_orders por seller_id
const { data: sellerOrders } = await supabase
  .from('ecommerce_orders')
  .select('envio_id, seller_id')
  .in('seller_id', calcSellers)
  .not('envio_id', 'is', null)
  .gte('fecha_entrega_estimada', fechaInicioStr)
  .lte('fecha_entrega_estimada', fechaFinStr);

// Bloque 2: Solo si hay sellers con cliente_id → buscar envíos comunes
if (uniqueClienteIds.length > 0) {
  // ... lógica existente de envíos comunes por remitente_id
}

// Combinar sin duplicados
```

**En `sellerBalances` query (cálculo para pestaña "Saldos por Seller"):**

La misma corrección: actualmente los `envioIdsBySeller` se llenan solo con envíos de `ecommerce_orders`, pero los `commonEnviosBySeller` solo se llenan si el seller tiene `cliente_id`. Esto ya está implementado parcialmente pero si hay sellers sin `cliente_id`, los `commonIds` de línea 247 quedan vacíos — en realidad esto es correcto para esa parte, el bug principal es en `calculateMutation`.

**También aplicar la corrección de prioridad exacta/substring** al bloque interno del `calculateMutation` (líneas 528-541) que aún usa el loop simple sin dos pasadas, haciéndolo consistente con el resto del código.

## Archivos a modificar

| Archivo | Cambios |
|---|---|
| `src/lib/generateSettlementPDF.ts` | Rediseño completo: helpers de imagen/color, branding en `generateSettlementPDF`, fetching de branding en las 3 funciones de descarga |
| `src/pages/PrintSettlement.tsx` | Pasar `branding` ya cargado a las funciones de descarga + actualizar firma |
| `src/pages/ecommerce/Settlements.tsx` | Refactorizar `calculateMutation` para incluir envíos aunque `uniqueClienteIds` esté vacío; corregir algoritmo de matching en ese bloque |

## Resultado esperado

- PDF con barra de color primario, logo del tenant (o nombre si no hay logo), tabla con cabecera coloreada y filas alternadas, footer con nombre de la app y numeración de páginas
- Envíos manuales (no ML Flex) de sellers son incluidos en la liquidación aunque el seller no tenga `cliente_id`
- El cálculo de totales en la liquidación refleja correctamente todos los envíos del período: tanto ML Flex como envíos comunes
