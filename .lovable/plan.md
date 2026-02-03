
# Plan: Sincronización de Estados E-Commerce y Mejora del Flujo de Registro Flex

## Resumen de Problemas Identificados

### 1. Estados de pedidos e-commerce no se actualizan
Cuando un envío cambia de estado (`entregado`, `recogido`, etc.), el `fulfillment_status` del `ecommerce_order` asociado **no se sincroniza**. Esto ocurre porque:
- `DeliveryConfirmation.tsx` actualiza solo la tabla `envios` sin actualizar `ecommerce_orders`
- `PickupConfirmation.tsx` no sincroniza el estado del pedido
- No existe un trigger ni lógica de sincronización automática

### 2. Sucursal origen no refleja quién hizo el pickup
El `register-ml-shipment` no asigna el campo `sucursal_origen_id` cuando crea el envío. Este debería ser la sucursal del usuario que escanea/registra el paquete (ej: "Administración").

### 3. Flujo incompleto desde e-commerce a Planificador
Actualmente para enviar pedidos al Planificador hay que:
1. Ir a Pedidos e-commerce
2. Crear envío individual desde cada orden
3. Ir manualmente al Planificador

**Flujo deseado**: Seleccionar múltiples órdenes con envío ya creado y enviarlas directamente al Planificador con un botón.

---

## Solución Propuesta

### Parte 1: Sincronización automática de estados

Crear un **Database Trigger** que sincronice automáticamente el `fulfillment_status` de `ecommerce_orders` cuando cambie el `estado` de un `envio` vinculado.

**Mapeo de estados:**
| Estado envío | fulfillment_status | order_status |
|--------------|-------------------|--------------|
| pendiente | pending | - |
| recogido | processing | shipped |
| en_transito | shipped | shipped |
| en_reparto | shipped | shipped |
| entregado | delivered | delivered |
| devuelto | pending | - |
| cancelado | cancelled | cancelled |

**Trigger SQL:**
```sql
CREATE OR REPLACE FUNCTION sync_ecommerce_order_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    UPDATE ecommerce_orders
    SET 
      fulfillment_status = CASE NEW.estado
        WHEN 'pendiente' THEN 'pending'
        WHEN 'recogido' THEN 'processing'
        WHEN 'en_bodega' THEN 'processing'
        WHEN 'en_transito' THEN 'shipped'
        WHEN 'en_reparto' THEN 'shipped'
        WHEN 'entregado' THEN 'delivered'
        WHEN 'devuelto' THEN 'pending'
        WHEN 'cancelado' THEN COALESCE(fulfillment_status, 'pending')
        ELSE fulfillment_status
      END,
      order_status = CASE NEW.estado
        WHEN 'recogido' THEN 'shipped'
        WHEN 'en_transito' THEN 'shipped'
        WHEN 'entregado' THEN 'delivered'
        WHEN 'cancelado' THEN 'cancelled'
        ELSE order_status
      END,
      updated_at = now()
    WHERE envio_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_ecommerce_order_status
AFTER UPDATE OF estado ON envios
FOR EACH ROW
EXECUTE FUNCTION sync_ecommerce_order_status();
```

---

### Parte 2: Asignar sucursal origen en registro ML

Modificar `supabase/functions/register-ml-shipment/index.ts` para:

1. Recibir opcionalmente el `user_id` del usuario que escanea
2. Buscar la `sucursal_id` del perfil del usuario
3. Asignar `sucursal_origen_id` al crear el envío

**Cambios en la Edge Function:**
```typescript
// Recibir user_id opcionalmente
const { ml_shipment_id, sender_id, user_id }: RegisterRequest = await req.json();

// Si hay user_id, obtener su sucursal
let sucursalOrigenId = null;
if (user_id) {
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('sucursal_id')
    .eq('user_id', user_id)
    .single();
  
  if (userProfile?.sucursal_id) {
    sucursalOrigenId = userProfile.sucursal_id;
  }
}

// Alternativa: usar sucursal_pickup_id del seller
if (!sucursalOrigenId && seller.sucursal_pickup_id) {
  sucursalOrigenId = seller.sucursal_pickup_id;
}

// Incluir en el insert del envío
{
  ...
  sucursal_origen_id: sucursalOrigenId,
  ...
}
```

**Cambios en los componentes de escaneo:**
- `ScanQR.tsx` y `MobileScanTab.tsx` deben enviar el `user?.id` al invocar `register-ml-shipment`

---

### Parte 3: Botón "Enviar al Planificador" en Pedidos E-Commerce

Modificar `src/pages/ecommerce/Orders.tsx` para agregar:

1. Un botón "Enviar al Planificador" cuando hay órdenes seleccionadas con envío creado
2. Navegación al Planificador con los `envio_id` preseleccionados

**Flujo:**
```text
Usuario selecciona órdenes con envío
        |
        v
Click "Enviar al Planificador"
        |
        v
Navega a /route-planner?envios=id1,id2,id3
        |
        v
Planificador precarga esos envíos seleccionados
```

**Cambios en Orders.tsx:**
```tsx
// Nuevo botón junto al existente
{selectedOrders.length > 0 && (
  <div className="flex gap-2">
    {/* Botón existente para crear envíos */}
    <Button onClick={handleCreateShipments}>
      <Truck className="mr-2 h-4 w-4" />
      Crear Envíos
    </Button>
    
    {/* NUEVO: Botón para enviar al planificador */}
    <Button 
      variant="outline"
      onClick={() => {
        const envioIds = filteredOrders
          ?.filter(o => selectedOrders.includes(o.id) && o.envio_id)
          .map(o => o.envio_id);
        
        if (envioIds?.length === 0) {
          toast({ title: 'Sin envíos', description: 'Las órdenes seleccionadas no tienen envío creado' });
          return;
        }
        
        navigate(`/route-planner?envios=${envioIds.join(',')}`);
      }}
    >
      <MapPin className="mr-2 h-4 w-4" />
      Enviar al Planificador ({ordersWithShipment.length})
    </Button>
  </div>
)}
```

**Cambios en RoutePlanner.tsx:**
- Leer parámetro `envios` de la URL
- Preseleccionar esos envíos al cargar la página

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| **Migración SQL** | Crear trigger `sync_ecommerce_order_status` |
| `supabase/functions/register-ml-shipment/index.ts` | Agregar `user_id` y asignar `sucursal_origen_id` |
| `src/pages/ScanQR.tsx` | Enviar `user?.id` al invocar la función |
| `src/components/mobile/MobileScanTab.tsx` | Enviar `user?.id` al invocar la función |
| `src/components/scan/MLRegisterDialog.tsx` | Pasar `userId` como prop y enviarlo |
| `src/pages/ecommerce/Orders.tsx` | Agregar botón "Enviar al Planificador" |
| `src/pages/RoutePlanner.tsx` | Leer y preseleccionar envíos desde URL |

---

## Flujo Optimizado de Pickup Flex

```text
Chofer/Administración escanea QR ML Flex
        |
        v
No existe -> Mostrar MLRegisterDialog
        |
        v
Click "Registrar" -> register-ml-shipment
  - Crea envío con sucursal_origen_id del usuario
  - Crea ecommerce_order vinculado
        |
        v
Éxito -> Opciones:
  1. "Seguir Escaneando" (pickup rápido)
  2. "Ir al Planificador" (asignar chofer)
        |
        v
Repetir para todos los paquetes Flex
        |
        v
Desde Pedidos E-Commerce:
  - Ver todos con envío creado
  - Seleccionar múltiples
  - Click "Enviar al Planificador"
        |
        v
Planificador muestra envíos preseleccionados
        |
        v
Asignar a chofer y crear ruta
```

---

## Notas Técnicas

1. **Trigger vs Código**: Usar trigger de base de datos garantiza sincronización incluso para cambios directos en la DB o desde Edge Functions
2. **Retrocompatibilidad**: El trigger solo se ejecuta en UPDATE, no afecta datos existentes
3. **Performance**: El trigger es ligero, solo actualiza una fila por cambio de estado
4. **Sucursal origen**: Si no hay usuario ni sucursal de pickup del seller, el campo queda null (comportamiento actual)
