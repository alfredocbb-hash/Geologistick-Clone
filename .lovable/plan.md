

# Plan: Agregar MercadoLibre a la Página de Integraciones

## Resumen

Agregaré la configuración de MercadoLibre a la página de integraciones existente (`/admin/integrations`) para que puedas configurar las credenciales de tu aplicación de MercadoLibre (Client ID y Client Secret) directamente desde el panel de administración.

---

## Cambios a Realizar

### Archivo: `src/pages/IntegrationSettings.tsx`

**1. Actualizar el tipo `IntegrationType`**

Agregar `'mercadolibre'` a la lista de tipos de integración:

```typescript
type IntegrationType = 'mercado_pago' | 'google_maps' | 'whatsapp' | 'email_smtp' | 'sms' | 'arca' | 'tiendanube' | 'mercadolibre';
```

**2. Agregar configuración de MercadoLibre al objeto `INTEGRATIONS_CONFIG`**

```typescript
mercadolibre: {
  name: 'MercadoLibre',
  description: 'Integración con Mercado Envíos Flex para sincronizar pedidos',
  icon: Package, // Icono de paquete
  docsUrl: 'https://developers.mercadolibre.com.ar/es_ar/api-docs-es',
  webhookUrl: '/functions/v1/mercadolibre-webhook',
  fields: [
    { 
      key: 'client_id', 
      label: 'Client ID (APP_ID)', 
      placeholder: '1234567890123456', 
      type: 'text', 
      required: true, 
      helpText: 'ID de tu aplicación en el Portal de Desarrolladores de MercadoLibre' 
    },
    { 
      key: 'client_secret', 
      label: 'Client Secret', 
      placeholder: 'Tu Client Secret', 
      type: 'password', 
      required: true, 
      helpText: 'Secret Key de tu aplicación de MercadoLibre' 
    },
  ],
},
```

**3. Agregar importación del ícono**

```typescript
import { Package } from 'lucide-react';
```

**4. Actualizar el grid de tabs**

Cambiar de `grid-cols-7` a `grid-cols-8` para acomodar la nueva pestaña.

---

## Resultado Visual

La página de integraciones mostrará una nueva pestaña "MercadoLibre" con:

```text
┌─────────────────────────────────────────────────────────────────┐
│  📦 MercadoLibre                                                 │
│  Integración con Mercado Envíos Flex para sincronizar pedidos   │
│                                                                  │
│  Estado: [Switch] Activo ✅                                      │
├─────────────────────────────────────────────────────────────────┤
│  Entorno: [🧪 Sandbox] [🚀 Production]                          │
├─────────────────────────────────────────────────────────────────┤
│  Client ID (APP_ID) *                                           │
│  [____________________________________]                          │
│  ID de tu aplicación en el Portal de Desarrolladores           │
│                                                                  │
│  Client Secret *                                                 │
│  [____________________________________] 👁                       │
│  Secret Key de tu aplicación de MercadoLibre                    │
├─────────────────────────────────────────────────────────────────┤
│  URL para Webhooks:                                              │
│  https://uhlgimnmfifmrxraorrl.supabase.co/functions/v1/...  📋 │
│  Configura esta URL en el panel de MercadoLibre                 │
├─────────────────────────────────────────────────────────────────┤
│  🔗 Ver documentación de MercadoLibre                           │
│                                                                  │
│                          [💾 Guardar Configuración]              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flujo de Configuración

1. El admin va a `/admin/integrations`
2. Selecciona la pestaña "MercadoLibre"
3. Ingresa el Client ID y Client Secret de su app de ML
4. Selecciona el entorno (Sandbox para pruebas, Production para real)
5. Guarda la configuración
6. Copia la URL del webhook y la configura en el Portal de Desarrolladores de ML
7. Los vendedores ya pueden conectar sus cuentas desde la sección de Sellers

---

## Sección Técnica

### Compatibilidad con Edge Functions

Las Edge Functions (`mercadolibre-oauth`, `mercadolibre-webhook`) ya están configuradas para buscar las credenciales en `system_integrations` con:
- `integration_type = 'mercadolibre'`
- `config_key` = `'client_id'` o `'client_secret'`
- Filtrado por `tenant_id`

### Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/pages/IntegrationSettings.tsx` | Agregar tipo y config de MercadoLibre |

