

# Fix: Eliminar mapeos duplicados en ml_status_mapping

## Problema encontrado

Ambas funciones (`mercadolibre-webhook` y `mercadolibre-sync`) consultan `ml_status_mapping` usando `.maybeSingle()`, que **falla silenciosamente cuando hay mas de 1 fila** para la misma combinacion `(ml_status, ml_substatus)`.

Actualmente hay duplicados:
- `not_delivered` + `receiver_absent` tiene 2 filas: una mapea a `no_entregado` (antigua) y otra a `primera_visita` (nueva)
- `shipped` + `second_visit` posiblemente tambien tiene conflicto con `en_reparto`

Cuando `.maybeSingle()` encuentra 2+ filas, retorna error/null, y la logica cae al fallback generico (sin substatus), lo que resulta en estados incorrectos como `pendiente`.

## Solucion

### 1. SQL Migration: Limpiar duplicados y agregar constraint unico

```sql
-- Eliminar mapeos antiguos que fueron reemplazados por los nuevos
DELETE FROM ml_status_mapping 
WHERE ml_status = 'not_delivered' 
  AND ml_substatus = 'receiver_absent' 
  AND estado_interno = 'no_entregado';

-- Actualizar shipped + second_visit si existe con estado incorrecto
UPDATE ml_status_mapping 
SET estado_interno = 'segunda_visita',
    descripcion = 'Segunda visita de entrega'
WHERE ml_status = 'shipped' 
  AND ml_substatus = 'second_visit' 
  AND estado_interno != 'segunda_visita';

-- Agregar constraint unico para prevenir futuros duplicados
ALTER TABLE ml_status_mapping 
ADD CONSTRAINT ml_status_mapping_unique_status 
UNIQUE (ml_status, ml_substatus);
```

### 2. Corregir el envio 46563818704

Actualizar manualmente el envio que quedo en estado incorrecto:

```sql
UPDATE envios 
SET estado_ml = 'primera_visita',
    ml_sync_status = 'synced',
    ml_last_sync_at = now()
WHERE ml_shipment_id = 46563818704;
```

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Base de datos (SQL) | Eliminar duplicados, agregar UNIQUE constraint, corregir envio |

No se requieren cambios en el codigo de las edge functions ya que la logica de consulta es correcta — el problema es solo datos duplicados en la tabla.

