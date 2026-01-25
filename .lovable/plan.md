
# Plan: Modulo e-Commerce para Clientes (Estilo Paqar)

## Vision General

Crear un modulo integral para logistica e-commerce que permita a empresas de transporte ofrecer servicios de fulfillment a tiendas online (Tiendanube, MercadoLibre, Shopify, WooCommerce), con sincronizacion automatica de pedidos, etiquetas, tracking y liquidaciones.

---

## Arquitectura Propuesta

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        SUPER ADMIN                                   │
│  Habilitar modulo e-commerce por tenant + gestionar integraciones   │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TENANT (Empresa Logistica)                        │
│   Configurar integraciones + gestionar sellers e-commerce           │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SELLERS (Tiendas Online)                        │
│   Conectar tienda + ver envios + tracking + liquidaciones           │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     WEBHOOKS / SYNC                                  │
│   Tiendanube → Edge Function → envios + notificaciones              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Fase 1: Estructura de Datos

### 1.1 Nueva Tabla: `ecommerce_sellers`
Tiendas online conectadas a cada tenant logistico.

```sql
CREATE TABLE ecommerce_sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  
  -- Datos del seller
  nombre TEXT NOT NULL,
  razon_social TEXT,
  cuit TEXT,
  email TEXT NOT NULL,
  telefono TEXT,
  direccion TEXT,
  ciudad TEXT,
  provincia TEXT,
  codigo_postal TEXT,
  
  -- Configuracion de plataforma
  plataforma TEXT NOT NULL, -- 'tiendanube', 'mercadolibre', 'shopify', 'woocommerce', 'manual'
  store_id TEXT, -- ID de la tienda en la plataforma
  store_url TEXT,
  access_token TEXT, -- Token OAuth encriptado
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Configuracion operativa
  sucursal_pickup_id UUID REFERENCES sucursales(id), -- Donde recoger
  tarifa_id UUID REFERENCES tarifas(id), -- Tarifa aplicada
  dias_retiro TEXT[], -- ['lunes', 'miercoles', 'viernes']
  horario_retiro TEXT,
  
  -- Cuenta corriente
  tiene_cuenta_corriente BOOLEAN DEFAULT false,
  limite_credito NUMERIC DEFAULT 0,
  saldo_cuenta_corriente NUMERIC DEFAULT 0,
  
  -- Estado
  activo BOOLEAN DEFAULT true,
  webhook_secret TEXT,
  ultimo_sync TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
```

### 1.2 Nueva Tabla: `ecommerce_orders`
Pedidos importados de plataformas e-commerce.

```sql
CREATE TABLE ecommerce_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES ecommerce_sellers(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID NOT NULL,
  
  -- Datos del pedido original
  external_order_id TEXT NOT NULL, -- ID en Tiendanube/ML
  external_order_number TEXT, -- Numero visible
  plataforma TEXT NOT NULL,
  
  -- Estado del pedido e-commerce
  order_status TEXT, -- 'pending', 'paid', 'shipped', 'delivered', 'cancelled'
  payment_status TEXT,
  fulfillment_status TEXT,
  
  -- Datos del comprador
  buyer_name TEXT NOT NULL,
  buyer_email TEXT,
  buyer_phone TEXT,
  buyer_dni TEXT,
  
  -- Direccion de entrega
  shipping_address TEXT NOT NULL,
  shipping_city TEXT,
  shipping_province TEXT,
  shipping_postal_code TEXT,
  shipping_lat NUMERIC,
  shipping_lng NUMERIC,
  shipping_notes TEXT,
  
  -- Productos (JSON)
  items JSONB, -- [{sku, name, quantity, price}]
  
  -- Valores
  subtotal NUMERIC,
  shipping_cost NUMERIC,
  total NUMERIC,
  
  -- Vinculacion con sistema logistico
  envio_id UUID REFERENCES envios(id), -- Cuando se crea el envio
  
  -- Metadata
  raw_data JSONB, -- Datos originales de la plataforma
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(seller_id, external_order_id)
);
```

### 1.3 Nueva Tabla: `seller_cuenta_corriente`
Movimientos financieros por seller.

```sql
CREATE TABLE seller_cuenta_corriente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES ecommerce_sellers(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL, -- 'cargo', 'pago', 'ajuste'
  monto NUMERIC NOT NULL,
  saldo_anterior NUMERIC DEFAULT 0,
  saldo_nuevo NUMERIC NOT NULL,
  descripcion TEXT,
  envio_id UUID REFERENCES envios(id),
  referencia TEXT,
  metodo_pago TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 1.4 Modificar Tabla `tenants`
Agregar flag de modulo e-commerce.

```sql
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS ecommerce_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ecommerce_config JSONB DEFAULT '{}';
```

### 1.5 Extender Enum `integration_type`

```sql
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'tiendanube';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'mercadolibre';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'shopify';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'woocommerce';
```

---

## Fase 2: Backend (Edge Functions)

### 2.1 `tiendanube-oauth`
Flujo OAuth para conectar tiendas.

```text
Frontend → tiendanube-oauth → Tiendanube Auth → Callback → Guardar tokens
```

### 2.2 `tiendanube-webhook`
Recibir notificaciones de nuevos pedidos.

```text
Tiendanube → Webhook → Validar firma → Crear/Actualizar ecommerce_orders
                                     → Auto-crear envio si configurado
```

### 2.3 `tiendanube-sync`
Sincronizacion manual/programada.

```text
Cron/Manual → Obtener pedidos recientes → Sincronizar ecommerce_orders
```

### 2.4 `ecommerce-create-shipment`
Convertir pedido e-commerce en envio logistico.

```text
ecommerce_orders → Calcular tarifa → Crear envio → Actualizar saldo cta cte
                                   → Notificar seller
```

### 2.5 `ecommerce-update-tracking`
Sincronizar estado de envio con plataforma.

```text
Cambio estado envio → Trigger → Actualizar fulfillment en Tiendanube/ML
```

---

## Fase 3: Frontend - Super Admin

### 3.1 Pagina: Gestion de Modulos por Tenant
Ruta: `/admin/tenant-modules`

Permitir al Super Admin:
- Ver lista de tenants
- Habilitar/deshabilitar modulo e-commerce por tenant
- Ver estadisticas de uso

### 3.2 Modificar `EditTenantDialog`
Agregar seccion de modulos habilitados.

---

## Fase 4: Frontend - Tenant Admin

### 4.1 Pagina: Sellers e-Commerce
Ruta: `/ecommerce/sellers`

Funcionalidades:
- Lista de sellers conectados
- Agregar seller manual o via OAuth
- Configurar tarifa, sucursal de pickup, dias de retiro
- Ver estado de sincronizacion
- Activar/desactivar sellers

### 4.2 Pagina: Pedidos e-Commerce
Ruta: `/ecommerce/orders`

Funcionalidades:
- Lista de pedidos importados (filtros: plataforma, estado, seller, fecha)
- Ver detalle de pedido
- Crear envio desde pedido (individual o masivo)
- Estado de sincronizacion

### 4.3 Pagina: Liquidaciones Sellers
Ruta: `/ecommerce/settlements`

Funcionalidades:
- Cuenta corriente por seller
- Generar liquidacion periodica
- Registrar pagos
- Exportar a PDF/Excel

### 4.4 Configuracion de Integraciones
Agregar tabs a `/admin/integrations`:
- Tiendanube (client_id, client_secret)
- MercadoLibre (app_id, secret_key)
- Shopify (API key, secret)
- WooCommerce (consumer_key, consumer_secret)

---

## Fase 5: Portal Seller (Opcional - Fase 2)

### 5.1 Nuevo rol: `seller`
Acceso limitado a:
- Ver sus pedidos
- Ver sus envios y tracking
- Ver estado de cuenta corriente
- Solicitar retiros

### 5.2 Login separado
Ruta: `/seller-portal`

---

## Fase 6: Integracion Tiendanube (Detalle)

### 6.1 Flujo OAuth

```text
1. Tenant configura client_id y client_secret
2. Seller hace click en "Conectar Tiendanube"
3. Redirect a Tiendanube para autorizar
4. Callback con code → Exchange por access_token
5. Guardar tokens en ecommerce_sellers
6. Registrar webhook en Tiendanube
```

### 6.2 Endpoints Tiendanube a Usar

| Endpoint | Uso |
|----------|-----|
| `GET /orders` | Obtener pedidos |
| `POST /orders/{id}/fulfill` | Marcar como enviado |
| `POST /orders/{id}/pack` | Agregar tracking |
| `POST /webhooks` | Registrar webhook |

### 6.3 Webhook Events

| Evento | Accion |
|--------|--------|
| `order/created` | Crear ecommerce_order |
| `order/paid` | Actualizar estado, auto-crear envio |
| `order/cancelled` | Cancelar envio si existe |

---

## Funcionalidades Reutilizadas del Proyecto Actual

| Funcionalidad | Componente Existente |
|---------------|---------------------|
| Tracking publico | `/tracking`, `public-tracking` edge function |
| Etiquetas | `PrintLabel.tsx`, QR generation |
| Rutas y optimizacion | `RoutePlanner.tsx`, `snap-to-roads` |
| Comisiones choferes | `comisiones`, `liquidaciones` |
| Cuenta corriente | Patron de `cliente_cuenta_corriente` |
| Integraciones | `system_integrations` + `IntegrationSettings.tsx` |
| Multi-tenant | RLS, `tenant_id` en todas las tablas |
| Google Maps | `AddressAutocomplete`, geocoding |

---

## Estructura de Archivos Nuevos

```text
src/
├── pages/
│   ├── ecommerce/
│   │   ├── Sellers.tsx
│   │   ├── Orders.tsx
│   │   ├── Settlements.tsx
│   │   └── ConnectStore.tsx
│   └── admin/
│       └── TenantModules.tsx
├── components/
│   └── ecommerce/
│       ├── SellerCard.tsx
│       ├── OrderDetailsDialog.tsx
│       ├── CreateShipmentFromOrder.tsx
│       ├── BulkCreateShipments.tsx
│       └── SellerSettlementDialog.tsx
├── hooks/
│   └── useEcommerceConfig.ts

supabase/functions/
├── tiendanube-oauth/
├── tiendanube-webhook/
├── tiendanube-sync/
├── ecommerce-create-shipment/
└── ecommerce-update-tracking/
```

---

## Proximos Pasos

1. **Aprobacion del plan** - Confirmar alcance y prioridades
2. **Fase 1** - Crear estructura de base de datos
3. **Fase 2** - Implementar edge functions para Tiendanube
4. **Fase 3** - UI de Super Admin (habilitar modulo por tenant)
5. **Fase 4** - UI de Tenant Admin (gestion de sellers y pedidos)
6. **Fase 5** - Integraciones adicionales (MercadoLibre, Shopify)
7. **Fase 6** - Portal seller (opcional)

---

## Preguntas de Clarificacion

Antes de implementar, necesito confirmar:

1. **Plataformas prioritarias**: Empezamos solo con Tiendanube o tambien MercadoLibre desde el inicio?

2. **Auto-creacion de envios**: Cuando un pedido llega como "pagado", se crea automaticamente el envio o requiere confirmacion manual?

3. **Portal Seller**: Los sellers tendran acceso web propio o todo se gestiona desde el tenant?

4. **Modelo de cobro**: El tenant cobra al seller por envio, por suscripcion, o ambos?
