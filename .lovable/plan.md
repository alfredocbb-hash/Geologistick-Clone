

## Plan: Mostrar tracking externo en liquidaciones, planificador y navegación

### Problema
Los envíos de terciarizados tienen un `tracking_externo` que no se muestra en varias pantallas clave. Ya se muestra correctamente en `ThirdPartySettlements`, `PrintSettlement`, `Shipments` y `ShipmentDetailsDialog`, pero falta en:

1. **Liquidaciones de choferes** (`DriverSettlements.tsx`)
2. **Planificador de rutas** (`RoutePlanner.tsx`)
3. **Navegación de ruta activa** (`ActiveRouteNavigation.tsx`)
4. **Detalle de liquidación de chofer** (`SettlementDetailDialog.tsx`)
5. **Liquidaciones de partners** (`PartnerSettlementsTab.tsx`, `PartnerSettlementDetailDialog.tsx`)

### Cambios

**`src/pages/DriverSettlements.tsx`**:
- Agregar `tracking_externo` al `selectFields` de la query
- Agregar `tracking_externo` a la interfaz `EnvioParaLiquidar`
- En la tabla, mostrar `tracking_externo || tracking_number`

**`src/pages/RoutePlanner.tsx`**:
- Ya usa `select(*)` así que `tracking_externo` ya viene en los datos
- En todos los lugares donde se muestra `tracking_number` (lista de envíos, tabla, drag & drop), usar `envio.tracking_externo || envio.tracking_number`

**`src/pages/ActiveRouteNavigation.tsx`**:
- Agregar `tracking_externo` a las dos queries (hoja_ruta_envios y ruta_paradas)
- En la lista de paradas, mostrar `tracking_externo || tracking_number`

**`src/components/settlements/SettlementDetailDialog.tsx`**:
- Agregar `tracking_externo` a las queries de comisiones y detalles
- Mostrar `tracking_externo || tracking_number` en la tabla

**`src/components/settlements/PartnerSettlementsTab.tsx`**:
- Agregar `tracking_externo` a la query y la interfaz `CalculatedShipment`
- Mostrar en tabla

**`src/components/settlements/PartnerSettlementDetailDialog.tsx`**:
- Agregar `tracking_externo` a la query
- Mostrar en tabla y resumen

### Patrón de display
En todos los casos: `{envio.tracking_externo || envio.tracking_number}` — prioridad al tracking externo si existe.

| Archivo | Cambio |
|---------|--------|
| `DriverSettlements.tsx` | Query + interfaz + display |
| `RoutePlanner.tsx` | Display (datos ya disponibles) |
| `ActiveRouteNavigation.tsx` | Query + display |
| `SettlementDetailDialog.tsx` | Query + display |
| `PartnerSettlementsTab.tsx` | Query + interfaz + display |
| `PartnerSettlementDetailDialog.tsx` | Query + display |

No se requiere migración de base de datos.

