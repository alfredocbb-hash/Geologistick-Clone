

# Plan: Soporte Completo de Escaneo ML y Liquidación para Sellers

## Resumen Ejecutivo

Este plan habilita el flujo completo para envíos **MercadoLibre Flex** y **Tiendanube**, asegurando que:
- Sucursales y choferes puedan escanear QR de ML y procesar los envíos
- Los envíos escaneados se puedan planificar en el Planificador de Rutas
- Los cargos se registren automáticamente en la cuenta corriente del seller
- Se puedan generar liquidaciones unificadas de todos los servicios

## Gaps Identificados

| Componente | Estado Actual | Problema |
|------------|---------------|----------|
| Escaneo Web (ScanQR.tsx) | No soporta ML | Solo busca por `tracking_number`, no por `ml_shipment_id` |
| Webhook ML | Crea envío sin cargo | No registra movimiento en `seller_cuenta_corriente` |
| Planificador | Funcional | Los envíos ML ya aparecen si tienen `chofer_id = null` |
| Liquidaciones | Funcional | Ya soporta liquidar movimientos de sellers |

## Cambios Técnicos

### 1. Agregar Soporte ML al Escaneo Web

**Archivo**: `src/pages/ScanQR.tsx`

Modificar `handleScan` para detectar QR de MercadoLibre y buscar por `ml_shipment_id`:

```typescript
// En handleScan(), después de detectar HR:
// Detectar ML shipment ID
const parsed = parseQRCode(data);

if (parsed.type === 'ml_shipment') {
  // Buscar envío por ml_shipment_id
  const { data: mlShipment } = await supabase
    .from('envios')
    .select(...)
    .eq('ml_shipment_id', parseInt(parsed.value))
    .maybeSingle();
  
  if (mlShipment) {
    setScannedShipment(mlShipment);
    // Mostrar MLDeliveryDialog si es chofer, o ReceiveShipmentDialog si es sucursal
    return;
  }
}
```

### 2. Agregar Dialog de Recepción ML para Sucursales

**Archivo**: `src/pages/ScanQR.tsx`

Importar y agregar `MLDeliveryDialog` para mostrar cuando se escanea un envío ML:

```typescript
import { MLDeliveryDialog } from '@/components/scan/MLDeliveryDialog';

// Estado
const [showMLDeliveryDialog, setShowMLDeliveryDialog] = useState(false);

// En handleShipmentAction, detectar envío ML
if (shipment.ml_shipment_id) {
  setShowMLDeliveryDialog(true);
  return;
}
```

### 3. Registrar Cargo en Cuenta Corriente desde Webhook

**Archivo**: `supabase/functions/mercadolibre-webhook/index.ts`

Después de crear el envío, verificar si el seller tiene cuenta corriente y registrar el cargo:

```typescript
// Después de crear el envío exitosamente
if (seller.tiene_cuenta_corriente) {
  // Calcular precio según tarifa del seller
  let precio = 0;
  if (seller.tarifa_id) {
    const { data: tarifa } = await supabase
      .from('tarifas')
      .select('precio_base')
      .eq('id', seller.tarifa_id)
      .single();
    precio = tarifa?.precio_base || 0;
  }

  if (precio > 0) {
    const saldoAnterior = seller.saldo_cuenta_corriente || 0;
    const saldoNuevo = saldoAnterior + precio;

    // Registrar cargo
    await supabase
      .from('seller_cuenta_corriente')
      .insert({
        seller_id: seller.id,
        tipo: 'cargo',
        monto: precio,
        saldo_anterior: saldoAnterior,
        saldo_nuevo: saldoNuevo,
        descripcion: `Envío ML Flex ${trackingNumber}`,
        envio_id: envio.id,
      });

    // Actualizar saldo del seller
    await supabase
      .from('ecommerce_sellers')
      .update({ saldo_cuenta_corriente: saldoNuevo })
      .eq('id', seller.id);

    // Actualizar precio en el envío
    await supabase
      .from('envios')
      .update({ precio_total: precio })
      .eq('id', envio.id);
  }
}
```

### 4. Modificar Interface de ScannedShipment para Incluir ML

**Archivo**: `src/pages/ScanQR.tsx`

Ampliar la interfaz para incluir campos ML:

```typescript
interface ScannedShipment {
  // ... campos existentes
  ml_shipment_id?: number | null;
  ml_order_id?: number | null;
  ml_sync_status?: string | null;
  direccion_entrega?: string | null;
  ciudad_entrega?: string | null;
  precio_total?: number;
  pago_contra_entrega?: boolean | null;
}
```

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/ScanQR.tsx` | Agregar parseQRCode, búsqueda por ml_shipment_id, MLDeliveryDialog |
| `supabase/functions/mercadolibre-webhook/index.ts` | Registrar cargo en cuenta corriente, calcular precio con tarifa |

## Flujo Completo Resultante

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO UNIFICADO                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [MercadoLibre]     [Tiendanube]      [Envío Manual]           │
│       │                  │                  │                   │
│       ▼                  ▼                  ▼                   │
│  ┌─────────┐       ┌─────────┐       ┌─────────┐               │
│  │ Webhook │       │ Webhook │       │ Panel   │               │
│  └────┬────┘       └────┬────┘       └────┬────┘               │
│       │                  │                  │                   │
│       ▼                  ▼                  ▼                   │
│  ┌──────────────────────────────────────────────┐               │
│  │          TABLA: envios                       │               │
│  │  + seller_cuenta_corriente (cargo)           │               │
│  └────────────────────┬─────────────────────────┘               │
│                       │                                         │
│                       ▼                                         │
│  ┌──────────────────────────────────────────────┐               │
│  │    Sucursal/Chofer ESCANEA QR                │               │
│  │    (ScanQR.tsx o MobileScanTab.tsx)          │               │
│  └────────────────────┬─────────────────────────┘               │
│                       │                                         │
│         ┌─────────────┼─────────────┐                          │
│         ▼             ▼             ▼                          │
│    [Recibir]    [Planificar]   [Entregar]                     │
│         │             │             │                          │
│         ▼             ▼             ▼                          │
│  ┌──────────────────────────────────────────────┐               │
│  │         LIQUIDACIÓN DEL SELLER               │               │
│  │   (Todos los cargos: ML + TN + Manual)       │               │
│  └──────────────────────────────────────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Requisitos Previos

Para que un seller pueda ser liquidado:

| Requisito | Campo en DB | Valor Necesario |
|-----------|-------------|-----------------|
| Cuenta corriente habilitada | `ecommerce_sellers.tiene_cuenta_corriente` | `true` |
| Tarifa asignada | `ecommerce_sellers.tarifa_id` | UUID de tarifa |
| Seller activo | `ecommerce_sellers.activo` | `true` |

## Resultado Esperado

1. **Sucursales** pueden escanear cualquier QR (tracking normal o ML Flex) y:
   - Recibir el paquete en sucursal
   - Marcar como "en bodega" o "en tránsito"

2. **Choferes** pueden escanear y:
   - Confirmar pickup
   - Iniciar reparto
   - Confirmar entrega (sincroniza con ML automáticamente)

3. **Planificador** muestra todos los envíos pendientes (incluyendo ML Flex) para ser asignados a rutas

4. **Liquidaciones** incluyen todos los cargos del seller:
   - Envíos manuales
   - Envíos Tiendanube
   - Envíos MercadoLibre Flex

