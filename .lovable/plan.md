

## Plan: Completar cambio de "En Bodega" a "En Sucursal"

---

## Archivos Pendientes Identificados

La búsqueda encontró 6 archivos que aún tienen "En Bodega":

| Archivo | Cambio Necesario |
|---------|------------------|
| `src/pages/ShipmentStatusGuide.tsx` | Actualizar label y descripción en guía de estados |
| `src/pages/Routes.tsx` | Cambiar SelectItem en filtro de estados |
| `src/components/shipments/ShipmentDetailsDialog.tsx` | Actualizar statusConfig |
| `src/components/scan/MLDeliveryDialog.tsx` | Actualizar mapping de estados |
| `src/components/mobile/MobileScanTab.tsx` | Actualizar función getStatusLabel |
| `src/pages/NewShipment.tsx` | **NO CAMBIAR** - Se refiere a almacenaje físico, no al estado |

---

## Cambios Específicos

### 1. `src/pages/ShipmentStatusGuide.tsx`

**Línea 40:** Cambiar label de "En Bodega" a "En Sucursal"
**Línea 41:** Actualizar descripción de "centro logístico" a "sucursal"
**Líneas 119-120:** Actualizar las acciones del rol "Operador/Bodega":
- "Recibir en bodega" → "Recibir en sucursal"

### 2. `src/pages/Routes.tsx`

**Línea 340:** Cambiar SelectItem
```text
Antes:  <SelectItem value="en_bodega">En Bodega</SelectItem>
Después: <SelectItem value="en_bodega">En Sucursal</SelectItem>
```

### 3. `src/components/shipments/ShipmentDetailsDialog.tsx`

**Línea 60:** Actualizar statusConfig
```text
Antes:  en_bodega: { label: 'En Bodega', ... }
Después: en_bodega: { label: 'En Sucursal', ... }
```

### 4. `src/components/scan/MLDeliveryDialog.tsx`

**Línea 133:** Actualizar mapping
```text
Antes:  en_bodega: 'En bodega'
Después: en_bodega: 'En Sucursal'
```

### 5. `src/components/mobile/MobileScanTab.tsx`

**Líneas 362-363:** Actualizar función getStatusLabel
```text
Antes:  return 'En bodega';
Después: return 'En Sucursal';
```

---

## Notas

- **`src/pages/NewShipment.tsx`**: Las menciones a "bodega" en este archivo se refieren al **almacenaje físico** (servicio de guardado), no al estado del envío. Estas referencias deben mantenerse como están.

- El valor en base de datos (`en_bodega`) **no cambia**, solo las etiquetas visibles.

- Después de aplicar estos cambios, se deberá **publicar la aplicación** para que la versión pública de tracking muestre "En Sucursal" en lugar de "En Bodega".

---

## Resultado

Todos los lugares donde se muestra el estado `en_bodega` mostrarán consistentemente **"En Sucursal"** en toda la aplicación.

