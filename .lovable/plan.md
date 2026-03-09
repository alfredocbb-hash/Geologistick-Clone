

# Fix: Envíos entregados sin `fecha_entrega` no aparecen en liquidaciones

## Problema raíz

El envío ML-46550172976 (Ardebaco) tiene `estado = 'entregado'` pero `fecha_entrega = NULL`. El historial muestra que fue entregado el 03/03/2026 13:59 UTC.

Esto afecta a **616 envíos entregados** del tenant que no tienen `fecha_entrega` asignada.

El fallback actual en Settlements busca envíos sin `fecha_entrega` filtrando por `created_at`, pero este envío fue *creado* el 27/02 y *entregado* el 03/03, así que no cae en ningún rango correcto.

## Causa

No existe un trigger en la base de datos que asigne automáticamente `fecha_entrega = NOW()` cuando un envío cambia su estado a `'entregado'`. Los webhooks de ML y las actualizaciones manuales nunca setean este campo.

## Solución

### 1. Crear trigger de base de datos (migración SQL)

Crear una función + trigger que al detectar `NEW.estado = 'entregado'` y `fecha_entrega IS NULL`, asigne `fecha_entrega = NOW()`.

```sql
CREATE OR REPLACE FUNCTION public.set_fecha_entrega_on_delivered()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.estado = 'entregado' AND NEW.fecha_entrega IS NULL THEN
    NEW.fecha_entrega := NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_fecha_entrega
  BEFORE INSERT OR UPDATE ON public.envios
  FOR EACH ROW EXECUTE FUNCTION public.set_fecha_entrega_on_delivered();
```

### 2. Backfill de datos existentes (misma migración)

Corregir los 616 envíos entregados sin fecha, usando la fecha del historial cuando esté disponible:

```sql
UPDATE envios e
SET fecha_entrega = COALESCE(
  (SELECT h.created_at FROM envio_historial h 
   WHERE h.envio_id = e.id AND h.estado_nuevo = 'entregado' 
   ORDER BY h.created_at DESC LIMIT 1),
  e.updated_at
)
WHERE e.estado = 'entregado' AND e.fecha_entrega IS NULL;
```

### 3. Eliminar fallback innecesario en Settlements.tsx

Una vez que el trigger y el backfill están en su lugar, las queries de "envíos sin fecha_entrega filtrados por created_at" (Query 2 en cada sección) ya no son necesarias. Sin embargo, las mantendremos como red de seguridad por si algún caso edge escapa al trigger.

## Archivos a modificar

| Cambio | Tipo |
|--------|------|
| Migración SQL: trigger + backfill | Base de datos |
| No se requieren cambios en código frontend | - |

