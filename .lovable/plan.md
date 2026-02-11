
# Fix: Reprogramar no avanza a la siguiente parada

## Problema
Cuando el chofer reprograma un envio, el estado se cambia a `pendiente` via optimistic update, pero la logica de `nextStop` sigue considerando envios en estado `pendiente` como pendientes de entrega. El envio reprogramado sigue apareciendo como "Proxima Entrega" hasta que el refetch del servidor lo elimine (porque el RPC limpia el `chofer_id`).

## Solucion

### 1. Optimistic update: eliminar el envio de la lista (`RescheduleDialog.tsx`)
En lugar de cambiar el estado a `pendiente` en el optimistic update, **filtrar el envio de la lista** para que desaparezca inmediatamente de la interfaz del chofer.

```typescript
// Antes (problematico):
return old.map((p) => 
  p.envio?.id === shipment.id 
    ? { ...p, envio: { ...p.envio, estado: 'pendiente' } }
    : p
);

// Despues (correcto):
return old.filter((p) => p.envio?.id !== shipment.id);
```

Aplicar el mismo cambio para ambos query caches: `my-active-route-paradas` y `my-active-route-envios-hoja`.

### 2. Rollback: restaurar la lista completa si falla (`RescheduleDialog.tsx`)
El rollback ya esta implementado correctamente: si la mutacion falla, se restauran los datos anteriores completos.

### Detalle tecnico
- **Archivo a modificar**: `src/components/driver/RescheduleDialog.tsx`
- **Lineas afectadas**: ~63-79 (optimistic update en `onMutate`)
- No se requieren cambios en la base de datos ni en la logica de `nextStop`, ya que al filtrar el envio de la lista, automaticamente se selecciona la siguiente parada.
