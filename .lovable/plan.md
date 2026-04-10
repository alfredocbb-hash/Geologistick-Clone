

## Plan: Corregir ExchangeDialog — condición invertida + campos faltantes para ML

### Problemas encontrados

**1. Condición invertida (línea 552 de DeliveryConfirmation.tsx)**
```typescript
// ACTUAL (incorrecto):
if (shipment.es_cambio) { setShowExchangeDialog(true); }
// CORRECTO:
if (!shipment.es_cambio) { setShowExchangeDialog(true); }
```
El diálogo solo aparece cuando el envío YA es un cambio, en vez de aparecer en entregas normales.

**2. Campos faltantes para ExchangeDialog**
La prop `shipment` que se pasa al `ExchangeDialog` (línea 894) solo incluye `id`, `tracking_number`, `direccion_entrega`, `ciudad_entrega` y `nombre_destinatario`. Faltan los campos necesarios para:
- Detectar si es ML (`ml_shipment_id`)
- Crear el envío inverso (`tenant_id`, `remitente_id`, `destinatario_id`, `sucursal_origen_id`, `nombre_remitente`, `direccion_retiro`, `ciudad_retiro`)

**3. Queries sin campos ML**
Las queries en `ActiveRouteNavigation.tsx` (líneas 164-189 y 210-235) no incluyen `ml_shipment_id`, `tenant_id`, `remitente_id`, `destinatario_id`, ni `sucursal_origen_id`.

### Cambios

| Archivo | Cambio |
|---|---|
| `src/components/delivery/DeliveryConfirmation.tsx` | Invertir condición a `!shipment.es_cambio`. Agregar campos ML al interface `Shipment`. Pasar todos los campos necesarios al `ExchangeDialog`. |
| `src/pages/ActiveRouteNavigation.tsx` | Agregar `ml_shipment_id, tenant_id, remitente_id, destinatario_id, sucursal_origen_id` a ambas queries (hoja_ruta_envios y ruta_paradas). |

### Flujo resultante
1. Chofer confirma entrega normal → aparece ExchangeDialog → "¿Hay devolución?"
2. Si ML: el envío inverso va al seller de origen (busca en `ecommerce_orders` → `ecommerce_sellers`)
3. Si manual: va al remitente/sucursal de origen
4. Si el envío ya es un cambio (`es_cambio: true`): cierra directo sin preguntar

