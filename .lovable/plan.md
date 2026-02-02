

# Plan: Agregar Sincronizacion Manual para MercadoLibre Flex

## Problema Identificado

Los envios de MercadoLibre Flex solo entran al sistema via webhook cuando cambian a estado `ready_to_ship`. Los pedidos existentes (viejos) o aquellos cuyo webhook falló no se pueden recuperar porque:

1. No existe una edge function `mercadolibre-sync` equivalente a `tiendanube-sync`
2. El frontend `Sellers.tsx` solo muestra el boton "Sincronizar Ahora" para Tiendanube (linea 485)
3. Los sellers de ML conectados no tienen opcion de sincronizacion manual

## Solucion Propuesta

Crear una edge function `mercadolibre-sync` que consulte la API de MercadoLibre para traer envios Flex pendientes, y agregar el boton correspondiente en el frontend.

## Cambios Tecnicos

### 1. Nueva Edge Function: `mercadolibre-sync`

**Archivo**: `supabase/functions/mercadolibre-sync/index.ts`

La funcion:

1. Recibe `seller_id` del body
2. Verifica autenticacion JWT y permisos de tenant
3. Obtiene el access_token del seller (refrescando si es necesario)
4. Consulta la API de ML para obtener shipments con:
   - `logistic_type=self_service` (Flex)
   - `status=ready_to_ship`
5. Para cada shipment, verifica si ya existe en `envios` por `ml_shipment_id`
6. Crea los envios faltantes con la misma logica del webhook
7. Registra cargos en cuenta corriente si corresponde

```typescript
// Pseudocodigo
const shipmentsUrl = `${ML_API}/users/${seller.store_id}/shipping_labels/shipments/search?status=ready_to_ship&shipping_mode=self_service`;

for (const shipment of shipments) {
  // Verificar si ya existe
  const existing = await supabase.from('envios').select('id').eq('ml_shipment_id', shipment.id).maybeSingle();
  if (existing) continue;
  
  // Crear envio, order, cargo en cuenta corriente...
}
```

### 2. Actualizar Frontend: `Sellers.tsx`

**Archivo**: `src/pages/ecommerce/Sellers.tsx`

Agregar mutacion y boton para sincronizar ML:

```typescript
// Nueva mutacion (reutilizando logica existente)
const syncMLMutation = useMutation({
  mutationFn: async (sellerId: string) => {
    setSyncingSellerId(sellerId);
    const { data, error } = await supabase.functions.invoke('mercadolibre-sync', {
      body: { seller_id: sellerId },
    });
    if (error) throw error;
    return data;
  },
  // ... mismo onSuccess, onError que tiendanube
});

// En el dropdown menu, agregar para mercadolibre conectado:
{seller.plataforma === 'mercadolibre' && isConnected(seller) && (
  <DropdownMenuItem 
    onClick={() => syncMLMutation.mutate(seller.id)}
    disabled={syncingSellerId === seller.id}
  >
    <RefreshCw className="mr-2 h-4 w-4" />
    Sincronizar Ahora
  </DropdownMenuItem>
)}
```

## Archivos a Crear/Modificar

| Archivo | Accion |
|---------|--------|
| `supabase/functions/mercadolibre-sync/index.ts` | CREAR - Nueva edge function |
| `src/pages/ecommerce/Sellers.tsx` | MODIFICAR - Agregar boton sync ML |

## API de MercadoLibre Utilizada

Para obtener shipments Flex pendientes:

```text
GET /users/{user_id}/shipping_labels/shipments/search
  ?status=ready_to_ship
  &shipping_mode=self_service
  &limit=50
```

Para obtener detalles de cada shipment:

```text
GET /shipments/{shipment_id}
```

## Flujo Resultante

```text
Admin/Operador accede a Sellers
        |
        v
    Seller ML conectado
        |
        v
  Click "Sincronizar Ahora"
        |
        v
  mercadolibre-sync invocada
        |
        v
  ┌─────────────────────────────────────┐
  │ 1. Refresh token si vencido         │
  │ 2. GET shipments pendientes de ML   │
  │ 3. Filtrar solo Flex (self_service) │
  │ 4. Crear envios que faltan en BD    │
  │ 5. Registrar cargos si CC habilitada│
  └─────────────────────────────────────┘
        |
        v
  Toast: "X nuevos, Y existentes"
        |
        v
  Envios disponibles para escaneo!
```

## Resultado Esperado

1. Los sellers de MercadoLibre conectados veran el boton "Sincronizar Ahora"
2. Al hacer click, se traeran todos los envios Flex pendientes de la API de ML
3. Los envios se crearan en la tabla `envios` con `ml_shipment_id`
4. Al escanear el QR, el sistema los encontrara correctamente
5. Los cargos se registraran automaticamente en la cuenta corriente del seller

