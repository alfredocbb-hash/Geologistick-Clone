
# Corregir Liquidación de Choferes: Incluir envíos sin fecha de entrega

## Problema

Al generar una liquidacion para Lucas Galarza del 13/02/2026, solo se traen 6 envios de los 17 que realmente entrego. Esto ocurre porque **11 envios de Mercado Libre tienen `fecha_entrega = NULL`** a pesar de estar en estado "entregado". La consulta actual filtra exclusivamente por `fecha_entrega`, descartando los que no tienen esa fecha.

## Datos verificados en la base de datos

- 17 envios totales asignados a Lucas en rutas del 13/02
- 6 con `fecha_entrega` registrada (3 manuales ADMIN + 2 ML con ultima milla + 1 manual)
- 11 con `fecha_entrega = NULL` (todos ML-Flex, marcados como entregados pero sin fecha de entrega)

## Solucion

### Parte 1: Corregir datos existentes (migracion SQL)

Actualizar los 11 envios de Lucas y cualquier otro envio del sistema que este en estado "entregado" sin `fecha_entrega`, asignandoles como fecha de entrega su `updated_at` (momento en que se marco como entregado).

```sql
UPDATE envios 
SET fecha_entrega = updated_at 
WHERE estado = 'entregado' 
AND fecha_entrega IS NULL;
```

### Parte 2: Modificar la consulta de liquidacion (`src/pages/DriverSettlements.tsx`)

Cambiar la consulta para que use un fallback: si `fecha_entrega` es NULL, usar `created_at` como referencia. Esto se logra con un filtro OR en la query:

**Lineas 209-220 aprox - Query de envios:**

Actualmente:
```typescript
.eq('estado', 'entregado')
.or(`chofer_id.eq.${chofer.user_id},chofer_ultima_milla_id.eq.${chofer.user_id}`)
.gte('fecha_entrega', toLocalISOStart(fechaInicio))
.lte('fecha_entrega', toLocalISOEnd(fechaFin))
```

Cambiar a dos queries: una para envios con fecha_entrega en rango, y otra para envios sin fecha_entrega pero con created_at en rango. Luego combinar resultados eliminando duplicados.

Alternativa mas simple: ya que la migracion corrige los datos historicos, agregar un trigger o logica en el flujo de entrega para que siempre se registre `fecha_entrega` al marcar como entregado. Asi la consulta actual seguiria funcionando.

### Parte 3: Prevencion futura - Asegurar que siempre se registre fecha_entrega

Revisar los flujos que marcan envios como "entregado" (especialmente el webhook de ML y la sincronizacion de envios Flex) para garantizar que siempre se asigne `fecha_entrega` cuando el estado cambia a "entregado". Crear un trigger en la base de datos como red de seguridad:

```sql
CREATE OR REPLACE FUNCTION set_fecha_entrega_on_delivered()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'entregado' AND NEW.fecha_entrega IS NULL THEN
    NEW.fecha_entrega = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_fecha_entrega
BEFORE UPDATE ON envios
FOR EACH ROW
WHEN (NEW.estado = 'entregado' AND OLD.estado IS DISTINCT FROM 'entregado')
EXECUTE FUNCTION set_fecha_entrega_on_delivered();
```

## Resumen de cambios

1. **Migracion SQL**: Corregir envios historicos sin `fecha_entrega` + crear trigger preventivo
2. **`src/pages/DriverSettlements.tsx`**: Opcionalmente mejorar la query para ser mas robusta ante datos sin fecha_entrega (fallback a `created_at`)
