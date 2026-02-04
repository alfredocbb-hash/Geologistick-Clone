

# Plan: Cambiar Estado `en_bodega` a `en_sucursal`

## Resumen del Cambio

Este cambio renombra el estado de envío `en_bodega` a `en_sucursal` en toda la aplicación para alinear la terminología con el flujo logístico real (los paquetes están en sucursales, no en una bodega genérica).

## Alcance del Cambio

| Área | Impacto |
|------|---------|
| Base de datos | Modificar enum `shipment_status` + migrar datos existentes |
| Código frontend | 26 archivos con 294 referencias |
| Edge functions | Sin cambios (no usan este valor) |

## Datos Actuales en Producción

- **2 envíos** actualmente en estado `en_bodega`
- **54 registros** en historial que referencian `en_bodega`

---

## Fase 1: Migración de Base de Datos

La migración debe hacerse en un orden específico para evitar errores de integridad:

```sql
-- 1. Agregar nuevo valor al enum (PostgreSQL no permite renombrar valores directamente)
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'en_sucursal' AFTER 'recogido';

-- 2. Actualizar envíos existentes
UPDATE envios SET estado = 'en_sucursal' WHERE estado = 'en_bodega';

-- 3. Actualizar historial (estado_anterior y estado_nuevo son text, no enum)
UPDATE envio_historial SET estado_anterior = 'en_sucursal' WHERE estado_anterior = 'en_bodega';
UPDATE envio_historial SET estado_nuevo = 'en_sucursal' WHERE estado_nuevo = 'en_bodega';
```

**Nota**: En PostgreSQL no se puede eliminar un valor de un enum existente sin recrear el tipo. El valor `en_bodega` quedará en el enum pero sin uso.

---

## Fase 2: Cambios en Código Frontend

### Archivos a Modificar (26 archivos)

| Archivo | Cambios |
|---------|---------|
| `src/pages/Routes.tsx` | Actualizar filtros y mapeo de estados |
| `src/pages/LiveMap.tsx` | Actualizar filtros y propiedades |
| `src/pages/Drivers.tsx` | Actualizar filtros y mapeo de estados |
| `src/pages/RoutePlanner.tsx` | Actualizar filtros de estado |
| `src/pages/RouteSheets.tsx` | Actualizar filtros |
| `src/pages/ScanQR.tsx` | Actualizar mapeo y condiciones |
| `src/pages/TrackingEmbed.tsx` | Actualizar tipo y mapeo |
| `src/pages/Tracking.tsx` | Actualizar mapeo de estados |
| `src/pages/Shipments.tsx` | Actualizar filtros y mapeo |
| `src/pages/Dashboard.tsx` | Actualizar estadísticas |
| `src/pages/ActiveRouteNavigation.tsx` | Actualizar condiciones de estado |
| `src/pages/ShipmentStatusGuide.tsx` | Actualizar guía de estados |
| `src/components/mobile/MobileScanTab.tsx` | Actualizar condiciones |
| `src/components/mobile/MobileDeliveriesTab.tsx` | Actualizar filtros |
| `src/components/mobile/MobileHistoryTab.tsx` | Actualizar mapeo |
| `src/components/mobile/MobileHomeTab.tsx` | Actualizar estadísticas |
| `src/components/scan/ReceiveShipmentDialog.tsx` | Actualizar nuevo estado |
| `src/components/scan/ReceiveRouteSheetDialog.tsx` | Actualizar estado |
| `src/components/scan/BranchDeliveryDialog.tsx` | Actualizar condiciones |
| `src/components/shipments/ShipmentDetailsDialog.tsx` | Actualizar mapeo |
| `src/components/shipments/ChangeStatusDialog.tsx` | Actualizar opciones |
| `src/components/routes/EditRouteDialog.tsx` | Actualizar filtros |
| `src/components/routes/ThirdPartyShipmentsTab.tsx` | Actualizar filtros |
| `src/lib/generateShipmentReceiptPDF.ts` | Actualizar etiquetas |
| `src/lib/generateEPODPDF.ts` | Actualizar etiquetas |
| `src/lib/generateSettlementPDF.ts` | Actualizar etiquetas |

### Patrón de Cambio

Cada archivo requiere reemplazar:

```typescript
// ANTES
'en_bodega'
estado === 'en_bodega'
.in('estado', ['pendiente', 'recogido', 'en_bodega'])

// DESPUÉS  
'en_sucursal'
estado === 'en_sucursal'
.in('estado', ['pendiente', 'recogido', 'en_sucursal'])
```

---

## Flujo de Estados Actualizado

```text
pendiente → recogido → en_sucursal → en_transito → en_reparto → entregado
                            │                                      │
                            └──────────────────────────────────────┘
                                (para retiro en sucursal)
```

---

## Etiquetas de UI (ya correctas)

Las etiquetas de usuario ya muestran "En Sucursal" (según la memoria del proyecto). Este cambio solo afecta el valor interno en código y base de datos:

```typescript
// Mapeo actual (se mantiene igual la etiqueta)
en_sucursal: { label: 'En Sucursal', ... }  // Antes era en_bodega: { label: 'En Sucursal' }
```

---

## Orden de Implementación

1. **Primero**: Ejecutar migración de base de datos
2. **Segundo**: Actualizar todos los archivos de código
3. **Tercero**: Verificar que el archivo `types.ts` se regenere automáticamente

---

## Consideraciones

- El cambio es **retrocompatible** ya que los datos se migran antes de cambiar el código
- Las etiquetas de usuario no cambian (ya mostraban "En Sucursal")
- El historial se actualiza para mantener consistencia en reportes

