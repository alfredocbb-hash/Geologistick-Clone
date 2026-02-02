

# Plan: Integración Mercado Envíos Flex

## Resumen

Tu sistema actuará como plataforma logística para vendedores de MercadoLibre Flex. Los vendedores conectan sus cuentas, los pedidos Flex se sincronizan automáticamente como envíos en tu tabla `envios`, y los administradores asignan choferes desde el Planificador de Rutas existente. Los choferes confirman estados mediante escaneo, sincronizándose con MercadoLibre.

---

## Arquitectura

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MERCADO LIBRE                                       │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐   │
│  │  OAuth 2.0       │    │  Webhooks        │    │  Shipments API       │   │
│  │  /authorize      │    │  (shipments)     │    │  PUT status          │   │
│  └────────┬─────────┘    └────────┬─────────┘    └──────────┬───────────┘   │
└───────────┼──────────────────────┼───────────────────────────┼──────────────┘
            │                      │                           │
            ▼                      ▼                           ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                       EDGE FUNCTIONS                                       │
│  ┌────────────────┐  ┌────────────────────┐  ┌───────────────────────┐    │
│  │ mercadolibre-  │  │ mercadolibre-      │  │ mercadolibre-         │    │
│  │ oauth          │  │ webhook            │  │ update-status         │    │
│  └────────┬───────┘  └────────┬───────────┘  └───────────┬───────────┘    │
└───────────┼──────────────────┼───────────────────────────┼────────────────┘
            │                  │                           │
            ▼                  ▼                           ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           BASE DE DATOS                                    │
│   ecommerce_sellers     │      envios        │     ecommerce_orders       │
│   (plataforma=ML)       │  (ml_shipment_id)  │    (referencia pedido)     │
└───────────────────────────────────────────────────────────────────────────┘
            │                  │                           │
            ▼                  ▼                           ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                       FRONTEND                                             │
│  ┌────────────────┐  ┌────────────────────┐  ┌───────────────────────┐    │
│  │ Sellers.tsx    │  │ RoutePlanner.tsx   │  │ MobileScanTab.tsx     │    │
│  │ (Conectar ML)  │  │ (Asignar chofer)   │  │ (Confirmar estados)   │    │
│  └────────────────┘  └────────────────────┘  └───────────────────────┘    │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Flujo Operativo

1. **Vendedor conecta su cuenta ML** via OAuth en el panel de Sellers
2. **Webhook recibe notificación** de nuevo envío Flex (`shipments` topic)
3. **Sistema crea registro en `envios`** con tracking interno y referencia ML
4. **Admin planifica ruta** desde RoutePlanner (envíos ML aparecen igual que otros)
5. **Chofer escanea etiqueta ML** en el pickup
6. **Sistema detecta formato ML** y sincroniza estado `out_for_delivery`
7. **Chofer confirma entrega** con firma/foto
8. **Sistema sincroniza** estado `delivered` con MercadoLibre

---

## Fase 1: Credenciales ML

### Secretos a Configurar

El tenant configurará sus credenciales de aplicación ML en la tabla `system_integrations`:

| Campo | Descripción |
|-------|-------------|
| `mercadolibre_client_id` | APP_ID del portal de desarrolladores |
| `mercadolibre_client_secret` | SECRET_KEY |
| `mercadolibre_redirect_uri` | URL de callback |

---

## Fase 2: Modificaciones a Base de Datos

### Nuevas Columnas en `envios`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `ml_shipment_id` | bigint | ID del envío en MercadoLibre |
| `ml_order_id` | bigint | ID de la orden asociada |
| `ml_sync_status` | text | pending, synced, error |
| `ml_last_sync_at` | timestamptz | Última sincronización |

### Nuevas Columnas en `ecommerce_sellers` (ya existentes)

La tabla ya tiene las columnas necesarias:
- `plataforma`: valor `'mercadolibre'`
- `store_id`: user_id de ML
- `access_token`, `refresh_token`, `token_expires_at`
- `webhook_secret`

### Nueva Tabla: `ml_status_mapping`

Para mapear estados del sistema con estados de MercadoLibre:

| estado_interno | ml_status | ml_substatus |
|----------------|-----------|--------------|
| recogido | shipped | picked_up |
| en_reparto | shipped | out_for_delivery |
| entregado | delivered | - |
| no_entregado | not_delivered | (según razón) |

---

## Fase 3: Edge Functions

### `mercadolibre-oauth`

Flujo OAuth 2.0 similar al existente para Tiendanube:

**Endpoints:**
- `GET /authorize?seller_id=xxx` - Redirige a ML para autorización
- `GET /callback?code=xxx&state=seller_id` - Intercambia código por tokens

**Acciones:**
1. Almacenar tokens en `ecommerce_sellers`
2. Obtener `user_id` del vendedor via API
3. Registrar suscripción a webhooks

### `mercadolibre-webhook`

Recibe notificaciones del tópico `shipments`:

**Flujo:**
1. Validar firma HMAC del webhook
2. Extraer `shipment_id` del campo `resource`
3. Llamar `GET /shipments/{id}` para obtener detalles
4. Filtrar solo `logistic_type = 'self_service'` (Flex)
5. Si estado es `ready_to_ship`:
   - Crear registro en `ecommerce_orders`
   - Crear registro en `envios` con datos del destinatario
   - Marcar como `pendiente` para que aparezca en planificador

### `mercadolibre-update-status`

Sincroniza estados con la API de MercadoLibre:

**Llamada:**
```text
PUT /shipments/{shipment_id}
{
  "status": "shipped",
  "substatus": "out_for_delivery"
}
```

**Invocado cuando:**
- Chofer confirma pickup (recogido)
- Chofer sale a reparto (en_reparto)
- Chofer confirma entrega (entregado)
- Chofer reporta incidente (no_entregado)

---

## Fase 4: Actualización del QR Parser

### Formatos ML a Detectar

Las etiquetas de MercadoLibre usan estos formatos:

| Formato | Ejemplo | Tipo |
|---------|---------|------|
| Número puro | `40070866801` | shipment_id |
| Con prefijo | `ML:40070866801` | shipment_id |
| URL tracking | `mercadolibre.com/tracking?id=40070866801` | shipment_id |

### Modificaciones a `qrParser.ts`

```typescript
// Nuevo tipo de resultado
export interface ParsedQR {
  type: 'tracking' | 'route_sheet' | 'ml_shipment' | 'unknown';
  value: string;
  originalData: string;
}

// Nueva detección para ML
if (/^ML:?\d{8,}$/i.test(trimmed)) {
  return {
    type: 'ml_shipment',
    value: trimmed.replace(/^ML:/i, ''),
    originalData: data
  };
}

// Detección de código numérico largo (shipment_id ML)
if (/^\d{10,}$/.test(trimmed)) {
  return {
    type: 'ml_shipment',
    value: trimmed,
    originalData: data
  };
}
```

---

## Fase 5: Componente de Entrega ML

### `MLDeliveryDialog.tsx`

Diálogo específico cuando se escanea una etiqueta ML:

**Información mostrada:**
- Logo/badge de MercadoLibre Flex
- Shipment ID de ML
- Tracking interno del sistema
- Destinatario y dirección
- Productos del pedido
- Estado actual en ML

**Acciones disponibles:**

| Estado Actual | Acción | Resultado |
|---------------|--------|-----------|
| pendiente | "Confirmar Pickup" | Estado: recogido, ML: shipped |
| recogido/en_bodega | "Salir a Reparto" | Estado: en_reparto, ML: out_for_delivery |
| en_reparto | "Confirmar Entrega" | Estado: entregado, ML: delivered |
| en_reparto | "Reportar Problema" | Abre diálogo de incidentes |

---

## Fase 6: Modificaciones al Flujo de Escaneo

### `MobileScanTab.tsx`

```typescript
// Después de parsear el QR
if (parsed.type === 'ml_shipment') {
  // Buscar envío por ml_shipment_id
  const { data: shipment } = await supabase
    .from('envios')
    .select('*, destinatario:clientes!envios_destinatario_id_fkey(*)')
    .eq('ml_shipment_id', parsed.value)
    .maybeSingle();
    
  if (shipment) {
    setScannedShipment(shipment);
    setShowMLDeliveryDialog(true);
  } else {
    toast.error('Envío ML no encontrado', {
      description: `Shipment ID: ${parsed.value} no está registrado`
    });
  }
  return;
}
```

---

## Fase 7: UI de Administración

### Modificaciones a `Sellers.tsx`

Agregar botón "Conectar con MercadoLibre":

```text
┌─────────────────────────────────────────────────────────┐
│ Nuevo Seller                                             │
│                                                         │
│ Plataforma: [▾ MercadoLibre]                           │
│                                                         │
│ [🔗 Conectar con MercadoLibre]                         │
│                                                         │
│ Estado: ⏳ Pendiente de conexión                       │
└─────────────────────────────────────────────────────────┘
```

### Indicadores en `RoutePlanner.tsx`

Los envíos de MercadoLibre mostrarán un badge distintivo:

```text
┌─────────────────────────────────────────────────┐
│ ☑ 001-ENV-20260202-ABC                          │
│   📍 Av. Corrientes 1234, CABA                  │
│   [ML Flex] Juan Pérez                          │
│   └─ ML Shipment: 40070866801                   │
└─────────────────────────────────────────────────┘
```

---

## Consideraciones de Seguridad

1. **Tokens encriptados**: access_token y refresh_token almacenados seguros
2. **Validación HMAC**: Verificar firma de webhooks entrantes
3. **RLS**: Sellers solo ven sus propios envíos ML
4. **Refresh automático**: Edge function renueva tokens antes de expirar
5. **Logging**: Registrar todas las sincronizaciones para auditoría

---

## Archivos a Crear/Modificar

### Nuevos Archivos

```text
supabase/functions/
  ├── mercadolibre-oauth/index.ts
  ├── mercadolibre-webhook/index.ts
  └── mercadolibre-update-status/index.ts

src/components/
  └── scan/MLDeliveryDialog.tsx
```

### Archivos a Modificar

```text
src/lib/qrParser.ts                    # Detectar formatos ML
src/components/mobile/MobileScanTab.tsx  # Manejar tipo ml_shipment
src/pages/ecommerce/Sellers.tsx        # Botón conectar ML
src/pages/RoutePlanner.tsx             # Badge ML Flex en envíos
```

### Migraciones SQL

1. Agregar columnas ML a tabla `envios`
2. Crear tabla `ml_status_mapping` para mapeo de estados
3. Agregar índice en `ml_shipment_id` para búsqueda rápida

---

## Orden de Implementación

| Paso | Componente | Dependencia |
|------|------------|-------------|
| 1 | Migración SQL (columnas ML) | - |
| 2 | Edge Function: mercadolibre-oauth | Secretos ML configurados |
| 3 | UI: Botón conectar en Sellers.tsx | OAuth function |
| 4 | Edge Function: mercadolibre-webhook | OAuth completado |
| 5 | Edge Function: mercadolibre-update-status | Webhook activo |
| 6 | qrParser.ts: Detectar formatos ML | - |
| 7 | MLDeliveryDialog.tsx | Parser actualizado |
| 8 | MobileScanTab.tsx: Integrar diálogo ML | Diálogo listo |
| 9 | RoutePlanner.tsx: Badge ML Flex | Columnas ML |

