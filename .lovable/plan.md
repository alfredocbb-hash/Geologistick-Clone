

# Fix: Reprogramar no avanza (solución robusta)

## Diagnóstico

Hay dos problemas:

1. **La app Android carga desde la URL publicada** (`geologic.lovable.app`). Si el fix anterior no fue publicado, la app sigue con el código viejo. Verificar que se haya publicado.

2. **El RPC `reschedule_envio` no actualiza `ruta_paradas`**. Cuando se reprograma, el envío cambia (`chofer_id = NULL`, `estado = pendiente`) pero la parada en `ruta_paradas` queda con `estado = 'pendiente'`, como si aún estuviera activa. Esto puede causar confusión y bugs sutiles.

## Solución

### 1. Actualizar el RPC `reschedule_envio` (migración SQL)

Agregar al RPC una línea que marque la `ruta_parada` asociada como completada/cancelada, para que no quede colgada:

```sql
CREATE OR REPLACE FUNCTION reschedule_envio(p_envio_id uuid, p_new_date timestamptz, p_reason text DEFAULT '')
RETURNS void AS $$
DECLARE
  v_envio RECORD;
BEGIN
  SELECT id, estado, chofer_id, reprogramado_count, tenant_id
  INTO v_envio FROM envios WHERE id = p_envio_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Envio no encontrado'; END IF;

  IF v_envio.chofer_id != auth.uid()
     AND NOT is_admin(auth.uid())
     AND NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No tiene permisos para reprogramar este envio';
  END IF;

  -- Actualizar envío
  UPDATE envios SET
    fecha_entrega = p_new_date,
    estado = 'pendiente',
    chofer_id = NULL,
    reprogramado_count = COALESCE(v_envio.reprogramado_count, 0) + 1,
    ultima_reprogramacion = NOW()
  WHERE id = p_envio_id;

  -- NUEVO: Marcar parada(s) en rutas planificadas como 'reprogramado'
  UPDATE ruta_paradas SET
    estado = 'reprogramado',
    completada_at = NOW(),
    notas = COALESCE(notas || ' | ', '') || 'Reprogramado: ' || COALESCE(NULLIF(p_reason, ''), 'Sin motivo')
  WHERE envio_id = p_envio_id
    AND estado = 'pendiente';

  -- Historial
  INSERT INTO envio_historial (envio_id, estado_anterior, estado_nuevo, notas, created_by)
  VALUES (
    p_envio_id, v_envio.estado, 'pendiente',
    'Entrega reprogramada para ' || to_char(p_new_date, 'DD/MM/YYYY')
      || '. Motivo: ' || COALESCE(NULLIF(p_reason, ''), 'No especificado')
      || '. Intento #' || (COALESCE(v_envio.reprogramado_count, 0) + 1),
    auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Reforzar filtro en `ActiveRouteNavigation.tsx`

Agregar chequeo doble: excluir tanto por `chofer_id` como por `ruta_paradas.estado = 'reprogramado'`:

```typescript
const envios = allEnvios.filter(item => {
  const envio = item.envio;
  if (!envio) return false;

  // Excluir paradas reprogramadas (ruta_paradas.estado)
  if (item.estado === 'reprogramado') return false;

  if (isPlannedRoute) {
    return envio.chofer_id === user?.id;
  }
  return !envio.chofer_id || envio.chofer_id === user?.id;
});
```

### 3. Actualizar `nextStop` como seguridad adicional

Agregar chequeo de `estado = 'pendiente'` del envio para no incluir estados inesperados:

```typescript
const nextStop = useMemo(() => {
  return envios.find(e => {
    const envio = e.envio;
    if (!envio) return false;
    if (envio.estado === 'incidencia') return false;

    // Excluir envíos sin chofer asignado (reprogramados)
    if (!envio.chofer_id) return false;

    // ... resto de la lógica igual
  });
}, [envios]);
```

## Cambios

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Actualizar RPC `reschedule_envio` para marcar `ruta_paradas.estado = 'reprogramado'` |
| `src/pages/ActiveRouteNavigation.tsx` | Agregar filtro por `item.estado === 'reprogramado'` y chequeo `!envio.chofer_id` en `nextStop` |

## Resultado esperado

- Al presionar "Reprogramar": la parada se marca como 'reprogramado' en la DB
- El filtro la excluye por dos vías: `ruta_paradas.estado` y `envio.chofer_id`
- `nextStop` tiene una tercera capa de protección verificando `chofer_id`
- La vista avanza automáticamente a la siguiente parada

## Importante

Si estas probando en la app Android (APK), asegurate de **publicar** los cambios desde Lovable para que la app los tome (carga desde `geologic.lovable.app`).
