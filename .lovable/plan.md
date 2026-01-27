

# Plan: Completar Integración TiendaNube para Aprobación del Marketplace

## Estado Actual del Sistema

| Componente | Estado | Detalles |
|------------|--------|----------|
| OAuth 2.0 (`/authorize`, `/callback`) | Completo | Flujo funcional con intercambio de tokens |
| Almacenamiento de Credenciales | Completo | `access_token`, `refresh_token`, `token_expires_at` en BD |
| Headers API (User-Agent, Authentication) | Completo | Correctamente configurados |
| UI de Configuración | Completo | `/admin/integrations` y `/ecommerce/sellers` |
| Webhooks de Órdenes | Completo | `order/created`, `order/paid`, etc. |
| Webhook `app/uninstalled` | FALTANTE | Obligatorio para aprobación |
| Refresh Token Logic | FALTANTE | Token expira y no se renueva |
| Panel de Estado de Integración | FALTANTE | Mejoría UX solicitada |

---

## Cambios a Implementar

### 1. Handler para Webhook `app/uninstalled`

TiendaNube exige que cuando un usuario desinstala la app, se eliminen todas las credenciales sensibles.

**Archivo**: `supabase/functions/tiendanube-webhook/index.ts`

**Lógica**:
```text
SI event === "app/uninstalled":
  1. Buscar seller por store_id
  2. Limpiar credenciales sensibles:
     - access_token = null
     - refresh_token = null
     - token_expires_at = null
     - webhook_secret = null
     - shipping_carrier_id = null
  3. Mantener datos históricos (nombre, email, ordenes)
  4. Responder 200 OK
```

**Registro automático del webhook** en `tiendanube-oauth/index.ts`:
```typescript
const webhookEvents = [
  "order/created", 
  "order/paid", 
  "order/fulfilled", 
  "order/cancelled",
  "app/uninstalled"  // AGREGAR
];
```

### 2. Lógica de Refresh Token

TiendaNube emite tokens con expiración. Si el `access_token` expira, debemos usar el `refresh_token` para obtener uno nuevo.

**Archivo nuevo**: `supabase/functions/tiendanube-refresh-token/index.ts`

**Flujo**:
```text
1. Recibe seller_id
2. Obtiene refresh_token y tenant credentials
3. Llama a TiendaNube /apps/authorize/token con grant_type=refresh_token
4. Guarda nuevo access_token, refresh_token, token_expires_at
5. Retorna éxito o error
```

**Integración automática** en `tiendanube-sync` y `tiendanube-webhook`:
```typescript
// Antes de hacer cualquier request a la API
if (seller.token_expires_at && new Date(seller.token_expires_at) < new Date()) {
  // Token expirado, intentar refresh
  const refreshResult = await refreshToken(seller);
  if (!refreshResult.success) {
    return { error: "Token expirado, reconectar tienda" };
  }
  accessToken = refreshResult.newToken;
}
```

### 3. Panel de Estado de Integración

**Nuevo componente**: `src/components/ecommerce/SellerIntegrationStatus.tsx`

**Ubicación**: Tab en `SellerDetailsDialog` o sección expandida en la tabla

**Contenido**:
```text
┌────────────────────────────────────────────────────────┐
│  Estado de Conexión Tiendanube                         │
├────────────────────────────────────────────────────────┤
│  ✅ Conectado           Store ID: 1234567              │
│  Token expira: 15/02/2026 14:30                        │
│  Último sync: hace 2 horas (45 pedidos)                │
│                                                        │
│  Webhooks registrados:                                 │
│  ✅ order/created    ✅ order/paid                     │
│  ✅ order/fulfilled  ✅ order/cancelled                │
│  ✅ app/uninstalled                                    │
│                                                        │
│  [Sincronizar Ahora] [Reconectar] [Desconectar]       │
└────────────────────────────────────────────────────────┘
```

---

## Archivos a Modificar/Crear

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `supabase/functions/tiendanube-webhook/index.ts` | Modificar | Agregar handler para `app/uninstalled` |
| `supabase/functions/tiendanube-oauth/index.ts` | Modificar | Guardar `refresh_token` y `token_expires_at`, registrar webhook uninstall |
| `supabase/functions/tiendanube-sync/index.ts` | Modificar | Agregar verificación de token expirado |
| `supabase/functions/tiendanube-shipping-rates/index.ts` | Modificar | Agregar verificación de token expirado |
| `supabase/config.toml` | Ya configurado | `verify_jwt = false` para todos los endpoints TN |
| `src/components/ecommerce/SellerIntegrationStatus.tsx` | Crear | Panel visual de estado de conexión |
| `src/components/ecommerce/SellerDetailsDialog.tsx` | Modificar | Integrar panel de estado |

---

## Detalles Técnicos

### 1. Handler `app/uninstalled` (webhook)

```typescript
// En tiendanube-webhook/index.ts - agregar después de order/cancelled

else if (event === "app/uninstalled") {
  console.log("App uninstalled for store:", storeId);
  
  // Limpiar credenciales sensibles (GDPR compliance)
  const { error } = await supabase
    .from("ecommerce_sellers")
    .update({ 
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      webhook_secret: null,
      shipping_carrier_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("store_id", storeId);

  if (error) {
    console.error("Failed to clean credentials:", error);
  } else {
    console.log("Credentials cleaned successfully");
  }
  
  // Siempre responder 200 para que TiendaNube no reintente
}
```

### 2. Guardar Token Expiry en OAuth Callback

```typescript
// En tiendanube-oauth/index.ts - después de recibir tokenData

// TiendaNube devuelve expires_in en segundos
const expiresAt = tokenData.expires_in 
  ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
  : null;

const { error: updateError } = await supabase
  .from("ecommerce_sellers")
  .update({
    access_token: accessToken,
    refresh_token: tokenData.refresh_token || null,  // NUEVO
    token_expires_at: expiresAt,                      // NUEVO
    store_id: storeId,
    store_url: storeUrl,
    webhook_secret: webhookSecret,
    updated_at: new Date().toISOString(),
  })
  .eq("id", sellerId);
```

### 3. Función de Refresh Token (inline helper)

```typescript
// Helper function para usar en sync/webhook/shipping-rates
async function refreshAccessToken(
  supabase: any,
  seller: { id: string; refresh_token: string; tenant_id: string }
): Promise<{ success: boolean; newToken?: string; error?: string }> {
  
  // Obtener credenciales del tenant
  const { data: integrations } = await supabase
    .from("system_integrations")
    .select("config_key, config_value")
    .eq("tenant_id", seller.tenant_id)
    .eq("integration_type", "tiendanube")
    .eq("is_active", true);

  const configMap = Object.fromEntries(
    (integrations || []).map(i => [i.config_key, i.config_value])
  );

  if (!configMap.client_id || !configMap.client_secret) {
    return { success: false, error: "Missing credentials" };
  }

  // Solicitar nuevo token
  const response = await fetch("https://www.tiendanube.com/apps/authorize/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: configMap.client_id,
      client_secret: configMap.client_secret,
      grant_type: "refresh_token",
      refresh_token: seller.refresh_token,
    }),
  });

  if (!response.ok) {
    return { success: false, error: "Refresh failed" };
  }

  const tokenData = await response.json();
  const expiresAt = tokenData.expires_in 
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  // Actualizar en BD
  await supabase
    .from("ecommerce_sellers")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || seller.refresh_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", seller.id);

  return { success: true, newToken: tokenData.access_token };
}
```

### 4. Panel de Estado (React Component)

```typescript
interface IntegrationStatusProps {
  seller: Seller;
  onRefresh: () => void;
}

function SellerIntegrationStatus({ seller, onRefresh }: IntegrationStatusProps) {
  const isConnected = !!seller.access_token && !!seller.store_id;
  const isTokenExpired = seller.token_expires_at 
    && new Date(seller.token_expires_at) < new Date();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Estado de Conexión
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium text-green-700">Conectado</p>
                <p className="text-sm text-muted-foreground">
                  Store ID: {seller.store_id}
                </p>
              </div>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-red-500" />
              <p className="font-medium text-red-700">Desconectado</p>
            </>
          )}
        </div>

        {/* Token Expiry Warning */}
        {isTokenExpired && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              El token ha expirado. Reconecta la tienda.
            </AlertDescription>
          </Alert>
        )}

        {/* Last Sync */}
        {seller.ultimo_sync && (
          <div className="text-sm">
            <span className="text-muted-foreground">Último sync: </span>
            {formatDistanceToNow(new Date(seller.ultimo_sync), { 
              addSuffix: true, 
              locale: es 
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button size="sm" onClick={onRefresh}>
            <RefreshCw className="mr-1 h-3 w-3" />
            Sincronizar
          </Button>
          {!isConnected && (
            <Button size="sm" variant="outline">
              <Link2 className="mr-1 h-3 w-3" />
              Conectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Flujo Post-Implementación

```text
INSTALACIÓN (ya funciona)
1. Admin crea seller en Geologistick
2. Envía link de conexión al seller
3. Seller autoriza en TiendaNube
4. OAuth callback guarda tokens + expiry
5. Webhooks se registran (incluyendo app/uninstalled)

OPERACIÓN NORMAL
1. Webhook recibe order/created
2. Sistema verifica si token está por expirar
3. Si expirado → refresh automático
4. Procesa el pedido normalmente

DESINSTALACIÓN
1. Seller desinstala app desde TiendaNube
2. TiendaNube envía webhook app/uninstalled
3. Sistema limpia credenciales sensibles
4. Datos históricos se mantienen
5. Admin ve "Desconectado" en el panel
```

---

## Checklist para Aprobación TiendaNube

| Requisito | Estado |
|-----------|--------|
| OAuth 2.0 funcional | Listo |
| Almacenamiento seguro de tokens | Listo |
| Headers correctos (User-Agent) | Listo |
| Webhook `app/uninstalled` | Por implementar |
| Manejo de token expirado | Por implementar |
| UI de estado para el admin | Por implementar |
| GDPR: Limpieza de datos en uninstall | Por implementar |

---

## Orden de Implementación

1. **Modificar `tiendanube-oauth`**: Guardar `refresh_token` y `token_expires_at`, registrar webhook `app/uninstalled`
2. **Modificar `tiendanube-webhook`**: Agregar handler para `app/uninstalled`
3. **Modificar `tiendanube-sync`**: Agregar lógica de refresh antes de requests
4. **Modificar `tiendanube-shipping-rates`**: Agregar verificación de token (opcional, menos crítico)
5. **Crear `SellerIntegrationStatus`**: Panel visual de estado
6. **Integrar en `SellerDetailsDialog`**: Mostrar el panel

