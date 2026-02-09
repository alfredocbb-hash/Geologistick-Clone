
# Fix: Chofer no puede reprogramar envío (RLS violation)

## Problema

El error "new row violates row-level security policy for table envios" ocurre porque:

- La política RLS de UPDATE en `envios` requiere que `chofer_id = auth.uid()` para choferes
- Al reprogramar, el código pone `chofer_id: null` para liberar el envío
- Postgres evalúa la política contra los valores NUEVOS del row, y como `chofer_id` pasa a ser `null`, ya no cumple la condición y bloquea la operación

Es un caso clásico: el chofer tiene permiso para modificar SU envío, pero al quitarse a sí mismo como chofer, la fila resultante ya no pasa el check.

## Solución

Crear una función RPC con `SECURITY DEFINER` que ejecute la reprogramación con privilegios elevados, verificando internamente que el usuario sea el chofer asignado antes de proceder.

### 1. Migración SQL: Crear función `reschedule_envio`

```sql
CREATE OR REPLACE FUNCTION public.reschedule_envio(
  p_envio_id UUID,
  p_new_date TIMESTAMPTZ,
  p_reason TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_envio RECORD;
BEGIN
  -- Get current shipment and verify caller is the assigned driver
  SELECT id, estado, chofer_id, reprogramado_count, tenant_id
  INTO v_envio
  FROM envios
  WHERE id = p_envio_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Envío no encontrado';
  END IF;

  -- Verify the caller is the assigned driver OR an admin
  IF v_envio.chofer_id != auth.uid() 
     AND NOT is_admin(auth.uid()) 
     AND NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No tiene permisos para reprogramar este envío';
  END IF;

  -- Update the shipment
  UPDATE envios SET
    fecha_entrega = p_new_date,
    estado = 'pendiente',
    chofer_id = NULL,
    reprogramado_count = COALESCE(v_envio.reprogramado_count, 0) + 1,
    ultima_reprogramacion = NOW()
  WHERE id = p_envio_id;

  -- Insert history record
  INSERT INTO envio_historial (envio_id, estado_anterior, estado_nuevo, notas, created_by)
  VALUES (
    p_envio_id,
    v_envio.estado,
    'pendiente',
    'Entrega reprogramada para ' || to_char(p_new_date, 'DD/MM/YYYY') 
      || '. Motivo: ' || COALESCE(NULLIF(p_reason, ''), 'No especificado')
      || '. Intento #' || (COALESCE(v_envio.reprogramado_count, 0) + 1),
    auth.uid()
  );
END;
$$;
```

### 2. Actualizar RescheduleDialog.tsx

Reemplazar las dos llamadas separadas (update envios + insert historial) por una sola llamada RPC:

```typescript
const { error } = await supabase.rpc('reschedule_envio', {
  p_envio_id: shipment.id,
  p_new_date: newDate.toISOString(),
  p_reason: reason,
});
if (error) throw error;
```

Esto simplifica el código del componente y elimina el problema de RLS.

## Seccion tecnica

### Archivos afectados

- **Migración SQL**: nueva función `reschedule_envio` con SECURITY DEFINER
- **`src/components/driver/RescheduleDialog.tsx`**: reemplazar mutationFn (lineas 46-88) para usar `supabase.rpc('reschedule_envio', ...)` en vez de update + insert manuales
