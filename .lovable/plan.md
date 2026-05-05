## Mostrar dirección en Gestión de Envíos

Actualmente la tabla en `src/pages/Shipments.tsx` muestra columnas (Tracking, IDML, Remitente, Destinatario, CP Dest., Origen, Destino, Chofer, Estado, ...) pero no la dirección de entrega completa. La columna "Destino" solo muestra sucursal_destino o ciudad/dirección como fallback.

### Cambios

1. En `src/pages/Shipments.tsx`:
   - Agregar nueva columna `<TableHead>Dirección</TableHead>` después de "Destinatario" (antes de "CP Dest.").
   - Agregar `<TableCell>` correspondiente que muestre `envio.direccion_entrega || envio.destinatario?.direccion || '-'`, con `ciudad_entrega` como sub-texto en muted si existe.
   - Texto truncado con `max-w-[200px] truncate` y `title` para tooltip completo.

No se modifican filtros ni queries — los campos `direccion_entrega` y `destinatario.direccion` ya se traen.