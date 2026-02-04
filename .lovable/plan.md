## Plan: Completar cambio de "En Bodega" a "En Sucursal"

✅ **COMPLETADO**

---

## Archivos Modificados

| Archivo | Estado |
|---------|--------|
| `src/pages/ShipmentStatusGuide.tsx` | ✅ Actualizado label y descripción |
| `src/pages/Routes.tsx` | ✅ Cambiar SelectItem (modificado en iteración anterior) |
| `src/components/shipments/ShipmentDetailsDialog.tsx` | ✅ Actualizado statusConfig |
| `src/components/scan/MLDeliveryDialog.tsx` | ✅ Actualizado mapping de estados |
| `src/components/mobile/MobileScanTab.tsx` | ✅ Actualizado función getStatusLabel |
| `src/pages/NewShipment.tsx` | ⏸️ Sin cambios - Se refiere a almacenaje físico |

---

## Resultado

Todos los lugares donde se muestra el estado `en_bodega` ahora muestran consistentemente **"En Sucursal"** en toda la aplicación.
