

# Plan: Incluir estados ML en filtro de Reprogramados

## Cambio único

### Modificar: `src/components/routes/RescheduledShipmentsList.tsx` (línea 49)

Ampliar el filtro `.in('estado', ...)` para incluir los estados operativos de ML:

```typescript
// Antes
.in('estado', ['pendiente', 'recogido', 'en_sucursal'])

// Después
.in('estado', ['pendiente', 'recogido', 'en_sucursal', 'reprogramado', 'primera_visita', 'segunda_visita'])
```

También eliminar el filtro `.is('chofer_id', null)` (línea 50), ya que los envíos ML reprogramados suelen tener chofer asignado del intento previo y deben aparecer para re-asignación.

Un cambio de dos líneas. Sin cambios en backend.

