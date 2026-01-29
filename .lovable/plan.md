
# Plan: Corregir Nombres Incorrectos en Envíos Importados

## Diagnóstico del Problema

El importador CSV busca clientes por teléfono. Cuando no hay teléfono, usa `"0000000000"` y termina creando o reutilizando un **cliente "genérico"** que acumula todos los envíos sin teléfono. Esto causa que:

1. El cliente `Alejandro Maximiliano Echavarria` (tel: `54000000000`) tenga **192 envíos como remitente** y **171 como destinatario** vinculados
2. Los nombres correctos (`SANABRIA SEBASTIAN`, `Jonathan Leonel`, etc.) **sí están guardados** en los campos `nombre_remitente` y `nombre_destinatario` de la tabla `envios`
3. Las pantallas priorizan el nombre del **cliente relacionado** (`remitente?.nombre`) sobre el campo directo (`nombre_remitente`)

---

## Solución en 3 Partes

### Parte 1: Corregir el Importador CSV

**Archivo:** `src/components/import/ImportShipmentsDialog.tsx`

Cuando el CSV no trae teléfono:
- **NO crear ni vincular cliente** (`remitente_id = null`, `destinatario_id = null`)
- Solo guardar los nombres directamente en `nombre_remitente` y `nombre_destinatario`

| Cambio | Antes | Después |
|--------|-------|---------|
| Destinatario sin tel | `findOrCreateClient(nombre, "0000000000", ...)` | `destinatarioId = null` |
| Remitente sin tel | `findOrCreateClient(nombre, "0000000000", ...)` | `remitenteId = null` |

### Parte 2: Priorizar Campos Directos en las Pantallas

Todos los lugares que muestran nombres deben priorizar `nombre_destinatario`/`nombre_remitente` **antes** que el cliente relacionado.

| Archivo | Uso Actual | Cambio |
|---------|------------|--------|
| `Shipments.tsx` | Ya correcto ✅ | — |
| `PrintReceipt.tsx` | Ya correcto ✅ | — |
| `PrintLabel.tsx` | Ya correcto ✅ | — |
| `generateShipmentReceiptPDF.ts` | Ya correcto ✅ | — |
| `generateEPODPDF.ts` | Ya correcto ✅ | — |
| `ShipmentDetailsDialog.tsx` | `remitente.nombre` primero ❌ | Priorizar `nombre_remitente`/`nombre_destinatario` |
| `Tracking.tsx` | `remitente?.nombre` primero ❌ | Priorizar campos directos |
| `TrackingEmbed.tsx` | Usa edge function ❌ | Modificar edge function |
| `public-tracking/index.ts` | Retorna `remitente.nombre` ❌ | Incluir `nombre_remitente`/`nombre_destinatario` y priorizar |
| `PrintRouteSheet.tsx` | Ya prioriza ✅ | — |
| `MobileDeliveriesTab.tsx` | `destinatario?.nombre` primero ❌ | Priorizar campos directos |
| `MobileReceptionTab.tsx` | `remitente?.nombre` primero ❌ | Priorizar campos directos |
| `ReceiveRouteSheetDialog.tsx` | `destinatario?.nombre` primero ❌ | Priorizar campos directos |
| `EditRouteDialog.tsx` | `remitente?.nombre`/`destinatario?.nombre` primero ❌ | Priorizar campos directos |
| `Routes.tsx` | `destinatario?.nombre` primero ❌ | Priorizar campos directos |
| `Drivers.tsx` | `destinatario?.nombre` primero ❌ | Priorizar campos directos |
| `Payments.tsx` | `remitente?.nombre` o `destinatario?.nombre` primero ❌ | Priorizar campos directos |
| `BranchDeliveryDialog.tsx` | `destinatario?.nombre` primero ❌ | Priorizar campos directos |
| `RescheduledShipmentsList.tsx` | `remitente?.nombre`/`destinatario?.nombre` primero ❌ | Priorizar campos directos |
| `RoutePlanner.tsx` | Ya prioriza ✅ | — |
| `ShipmentMapPopup.tsx` | Ya prioriza ✅ | — |

### Parte 3: Limpiar Envíos Existentes (Desvincular Cliente Falso)

Ejecutar una **migración de datos** para:
1. **Desvincular** los envíos del cliente "falso" poniendo `remitente_id = null` y `destinatario_id = null` donde corresponda
2. Los nombres ya están guardados correctamente en `nombre_remitente` / `nombre_destinatario`, así que no se pierde información

```sql
-- Quitar referencias al cliente "falso" en remitente_id
UPDATE envios 
SET remitente_id = null 
WHERE remitente_id IN (
  SELECT id FROM clientes WHERE telefono IN ('54000000000', '0000000000')
);

-- Quitar referencias al cliente "falso" en destinatario_id  
UPDATE envios 
SET destinatario_id = null 
WHERE destinatario_id IN (
  SELECT id FROM clientes WHERE telefono IN ('54000000000', '0000000000')
);
```

---

## Resumen de Archivos a Modificar

| Archivo | Tipo |
|---------|------|
| `src/components/import/ImportShipmentsDialog.tsx` | Cambio lógica de importación |
| `src/components/shipments/ShipmentDetailsDialog.tsx` | Priorizar campos directos |
| `src/pages/Tracking.tsx` | Priorizar campos directos |
| `supabase/functions/public-tracking/index.ts` | Retornar y priorizar campos directos |
| `src/pages/TrackingEmbed.tsx` | Actualizar interfaz |
| `src/pages/Routes.tsx` | Priorizar campos directos |
| `src/pages/Drivers.tsx` | Priorizar campos directos |
| `src/pages/Payments.tsx` | Priorizar campos directos |
| `src/components/mobile/MobileDeliveriesTab.tsx` | Priorizar campos directos |
| `src/components/mobile/MobileReceptionTab.tsx` | Priorizar campos directos |
| `src/components/scan/ReceiveRouteSheetDialog.tsx` | Priorizar campos directos |
| `src/components/scan/BranchDeliveryDialog.tsx` | Priorizar campos directos |
| `src/components/routes/EditRouteDialog.tsx` | Priorizar campos directos |
| `src/components/routes/RescheduledShipmentsList.tsx` | Priorizar campos directos |
| **Migración SQL** | Limpiar datos existentes |

---

## Resultado Esperado

1. Los envíos ya importados mostrarán los nombres correctos (`Jonathan Leonel`, `SANABRIA SEBASTIAN`, etc.) en lugar de `Alejandro Maximiliano Echavarria`
2. Los nuevos envíos importados sin teléfono **no crearán ni usarán** clientes "fantasma"
3. Todas las pantallas del sistema (web y mobile) mostrarán los nombres correctos

