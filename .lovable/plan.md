

# Fix: Cambio manual a "En Sucursal" no registra ubicación ni permite re-despacho

## Problema

El envío ENV-NHJR8H fue cambiado manualmente a "En Sucursal" desde `ChangeStatusDialog`, pero:

1. **Historial duplicado**: Se generan DOS entradas de historial — una del trigger automático (`log_envio_estado_change`) que SÍ incluye el nombre de sucursal, y otra manual del código que solo dice "Estado cambiado manualmente a En Sucursal" sin especificar cuál.
2. **No actualiza `sucursal_entrega_id`**: El cambio manual no registra la ubicación física del paquete, por lo que la sucursal que lo tiene no lo ve en la lista de envíos disponibles para crear una hoja de ruta.

## Diagnóstico técnico

En `ChangeStatusDialog.tsx`:
- **Línea 160-168**: Solo actualiza `estado` (y opcionalmente `chofer_id`). No toca `sucursal_entrega_id`.
- **Línea 176-186**: Inserta manualmente una entrada de historial con nota genérica, duplicando la que ya crea el trigger `log_envio_estado_change`.

## Cambios

### `src/components/shipments/ChangeStatusDialog.tsx`

1. **Actualizar `sucursal_entrega_id` cuando el nuevo estado es `en_sucursal`**: Agregar la sucursal del usuario actual al update para que el paquete quede registrado físicamente en esa sede y aparezca en el filtro OR de RouteSheets.

2. **Eliminar la inserción manual de historial**: El trigger `log_envio_estado_change` ya genera entradas con notas contextuales que incluyen el nombre de la sucursal. La inserción manual duplica la información con menos detalle. Si el usuario escribe notas personalizadas, se agregarán como una entrada separada (solo si no están vacías).

```typescript
// Línea 160: agregar sucursal_entrega_id cuando es en_sucursal
const updateData: Record<string, any> = { estado: newStatus };
if (newStatus === 'pendiente') {
  updateData.chofer_id = null;
}
if (newStatus === 'en_sucursal' && profile?.sucursal_id) {
  updateData.sucursal_entrega_id = profile.sucursal_id;
}

// Línea 176-186: solo insertar historial si el usuario escribió notas custom
// (el trigger ya genera la entrada automática con nombre de sucursal)
if (notes && notes.trim()) {
  await supabase.from('envio_historial').insert({
    envio_id: envioId,
    estado_anterior: currentStatus,
    estado_nuevo: newStatus,
    notas: notes,
    created_by: user?.id,
  });
}
```

Con esto:
- El historial mostrará una sola entrada clara con el nombre de la sucursal (generada por el trigger)
- Si el usuario agrega notas, se verán como entrada adicional
- La sucursal que recibió el paquete podrá crear una hoja de ruta para re-despacharlo

