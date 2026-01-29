
# Plan: Corregir Nombres Incorrectos en Envíos Importados

## Estado: ✅ COMPLETADO

---

## Diagnóstico del Problema

El importador CSV buscaba clientes por teléfono. Cuando no había teléfono, usaba `"0000000000"` y terminaba creando o reutilizando un **cliente "genérico"** que acumulaba todos los envíos sin teléfono.

---

## Solución Implementada

### ✅ Parte 1: Corregir el Importador CSV

**Archivo:** `src/components/import/ImportShipmentsDialog.tsx`

- Ya NO crea ni vincula cliente cuando falta teléfono
- `destinatario_id = null` y `remitente_id = null` cuando no hay teléfono válido
- Los nombres se guardan directamente en `nombre_remitente` y `nombre_destinatario`

### ✅ Parte 2: Priorizar Campos Directos en las Pantallas

Todos los archivos actualizados para priorizar `nombre_destinatario`/`nombre_remitente`:

| Archivo | Estado |
|---------|--------|
| `ShipmentDetailsDialog.tsx` | ✅ |
| `Tracking.tsx` | ✅ |
| `public-tracking/index.ts` (Edge Function) | ✅ Desplegado |
| `Routes.tsx` | ✅ |
| `Drivers.tsx` | ✅ |
| `Payments.tsx` | ✅ |
| `MobileDeliveriesTab.tsx` | ✅ |
| `MobileReceptionTab.tsx` | ✅ |
| `ReceiveRouteSheetDialog.tsx` | ✅ |
| `EditRouteDialog.tsx` | ✅ |
| `RescheduledShipmentsList.tsx` | ✅ |

### ✅ Parte 3: Limpiar Envíos Existentes

Se ejecutó la migración SQL para desvincular el cliente "falso" de todos los envíos existentes:

```sql
UPDATE envios SET remitente_id = null 
WHERE remitente_id IN (SELECT id FROM clientes WHERE telefono IN ('54000000000', '0000000000'));

UPDATE envios SET destinatario_id = null 
WHERE destinatario_id IN (SELECT id FROM clientes WHERE telefono IN ('54000000000', '0000000000'));
```

---

## Resultado

1. ✅ Los envíos ya importados muestran los nombres correctos
2. ✅ Los nuevos envíos importados sin teléfono NO crean clientes "fantasma"
3. ✅ Todas las pantallas del sistema (web y mobile) muestran los nombres correctos
