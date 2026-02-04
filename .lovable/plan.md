

# Plan: Mostrar Envíos Devueltos sin Incidente en la Bandeja

## Situación Actual

La bandeja de incidencias solo muestra registros de la tabla `incidentes`. Sin embargo, existen envíos con estado "devuelto" que:

1. Fueron marcados antes de implementar el nuevo flujo de incidencias
2. No tienen un registro asociado en la tabla `incidentes`
3. Deberían poder ser gestionados (re-intentar, reprogramar, etc.)

## Opciones de Solución

| Opcion | Descripcion | Ventajas | Desventajas |
|--------|-------------|----------|-------------|
| **A) Migrar datos** | Crear registros de incidente para envios devueltos sin incidente | Mantiene logica actual, datos consistentes | Requiere migracion, asignar tipo de incidente generico |
| **B) Vista combinada** | Mostrar en bandeja: incidentes + envios devueltos sin incidente | No requiere migracion, solucion inmediata | Query mas compleja, logica duplicada |
| **C) Nueva pestana** | Agregar pestana "Devueltos sin gestionar" en la bandeja | Separacion clara, facil de entender | Duplicacion de UI |

## Solucion Recomendada: Opcion A - Migracion de Datos

La opcion mas limpia es crear registros de incidente para los envios devueltos que no tienen uno, y luego corregir el flujo para que siempre use el estado "incidencia" primero.

---

## Cambios a Realizar

### 1. Migracion de Datos

Crear registros de incidente para envios con estado "devuelto" que no tienen incidente:

```sql
INSERT INTO incidentes (envio_id, tenant_id, tipo, descripcion, estado, created_at)
SELECT 
  e.id,
  e.tenant_id,
  'otro',
  'Incidente creado automaticamente - envio marcado como devuelto sin registro de incidencia',
  'pendiente',
  COALESCE(e.updated_at, NOW())
FROM envios e
LEFT JOIN incidentes i ON i.envio_id = e.id
WHERE e.estado = 'devuelto'
  AND i.id IS NULL;
```

### 2. Actualizar Estado de Envios

Cambiar los envios de "devuelto" a "incidencia" para que puedan ser gestionados:

```sql
UPDATE envios 
SET estado = 'incidencia'
WHERE estado = 'devuelto'
  AND id IN (
    SELECT e.id FROM envios e
    INNER JOIN incidentes i ON i.envio_id = e.id
    WHERE i.estado = 'pendiente'
  );
```

### 3. Limpiar Incidentes Inconsistentes (Opcional)

Resolver incidentes cuyo envio ya fue entregado:

```sql
UPDATE incidentes 
SET estado = 'resuelto', 
    accion_tomada = 'entregado_posteriormente',
    resolucion = 'El envio fue entregado despues de reportar incidencia',
    resuelto_at = NOW()
WHERE estado = 'pendiente'
  AND envio_id IN (
    SELECT id FROM envios WHERE estado = 'entregado'
  );
```

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| Nueva migracion SQL | Migrar datos inconsistentes |
| `IncidentActionDialog.tsx` | Manejar caso donde estado anterior no es "incidencia" |

## Flujo Corregido

Despues de esta migracion:

1. Todos los envios con problemas tendran un registro en `incidentes`
2. El estado del envio sera "incidencia" hasta que el admin decida la accion
3. Solo despues de resolver el incidente, el envio pasara a "devuelto", "pendiente", o "cancelado"

---

## Resultado Esperado

| Antes | Despues |
|-------|---------|
| 1 envio devuelto sin incidente visible | Todos los devueltos aparecen en bandeja |
| Estados inconsistentes | Estados sincronizados |
| Incidentes de envios entregados en pendiente | Incidentes resueltos automaticamente |

