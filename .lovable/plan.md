

# Fix: Actualizar estado de ENV-RFVNU8 y prevenir fallos silenciosos

## Diagnóstico

La hoja de ruta `hoja_ruta_envios` se marcó como "recibido" correctamente, pero el `UPDATE` sobre `envios` falló silenciosamente porque la migración RLS aún no estaba aplicada en ese momento. El envío quedó en `en_transito` sin `sucursal_entrega_id`.

## Solución

### 1. Migración SQL: Corregir datos de ENV-RFVNU8

Actualizar el envío manualmente y agregar entrada de historial:

```sql
UPDATE envios 
SET estado = 'en_sucursal', 
    chofer_id = NULL,
    sucursal_entrega_id = '53aa8cf8-660e-45f0-b4b8-3316520090cc'  -- Mar del Plata
WHERE id = 'd567b5a1-1b55-484b-bc4a-4234fadf9bd7';

INSERT INTO envio_historial (envio_id, estado_anterior, estado_nuevo, notas, ubicacion)
VALUES (
  'd567b5a1-1b55-484b-bc4a-4234fadf9bd7',
  'en_transito',
  'en_sucursal',
  'Corrección: recepción en sucursal Mar del Plata (hoja de ruta recibida)',
  'Mar del Plata'
);
```

### 2. `ReceiveRouteSheetDialog.tsx`: Detectar fallos silenciosos

Agregar `.select('id')` al update de envíos y verificar que las filas se actualizaron realmente. Si no se actualizó ninguna fila, mostrar error claro en vez de silenciar.

```tsx
const { data: updatedRows, error: enviosError } = await supabase
  .from("envios")
  .update(updateData)
  .in("id", selectedEnvios)
  .select("id");

if (enviosError) throw enviosError;
if (!updatedRows || updatedRows.length === 0) {
  throw new Error("No se pudieron actualizar los envíos. Verificá permisos.");
}
```

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Corregir estado + historial de ENV-RFVNU8 |
| `ReceiveRouteSheetDialog.tsx` | Agregar `.select('id')` y validar rows afectadas |

