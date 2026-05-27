## Diagnóstico del caso ENV-Q8FXT4

Verifiqué directamente en la base de datos: **el envío ENV-Q8FXT4 existe y NO está eliminado**.

- Tenant: Beraexpress
- Estado: `entregado` (entregado el 27/03/2026 en sucursal)
- Creado: 16/03/2026
- Chofer asignado, dirección en Hudson, etc.

### Por qué no aparece en Gestión de Envíos

`src/pages/Shipments.tsx` filtra la query por `created_at` entre `dateFrom` y `dateTo`, y ambos arrancan en `new Date()` (hoy ↔ hoy). Como ENV-Q8FXT4 fue creado hace ~2 meses, queda fuera del rango y no se muestra. No tiene nada que ver con un borrado.

### Sobre "buscar en envíos eliminados"

Importante: hoy la tabla `envios` **no tiene soft-delete** (no existe columna `deleted_at` ni `anulado`). Cuando se borra un envío desde Gestión de Envíos (`from('envios').delete()`) o desde el borrado masivo de super_admin, **se elimina físicamente** y no queda traza recuperable. Por lo tanto, "ver envíos eliminados" hoy no es posible sin antes implementar soft-delete o un log de auditoría — eso sería un trabajo aparte si lo querés encarar.

Para el problema reportado (no ver ENV-Q8FXT4) la solución correcta es un **buscador global por tracking** que ignore los filtros de fecha/estado, porque el envío existe y solo está oculto por el rango.

## Plan

### 1. Buscador global por tracking en Gestión de Envíos

Agregar un input "Buscar por tracking" arriba de la grilla en `src/pages/Shipments.tsx`. Comportamiento:

- Si el input tiene texto (≥3 caracteres), la query a `envios`:
  - **Ignora** `created_at`, `dateFrom`, `dateTo` y `statusFilter`.
  - Filtra con `.or('tracking_number.ilike.%TXT%,tracking_externo.ilike.%TXT%')` respetando la prioridad estándar del proyecto (`tracking_externo || tracking_number`).
  - Limita a 100 resultados ordenados por `created_at desc` para no traer toda la base.
- Si el input está vacío, vuelve al comportamiento actual (filtro por fechas + estado).
- Mostrar un cartel sutil cuando esté en "modo búsqueda global" indicando que los filtros de fecha/estado están desactivados, con botón "Limpiar búsqueda".

`queryKey` se extiende con el texto de búsqueda para invalidar bien la caché de React Query.

### 2. Aclaración visual cuando no hay resultados

En el estado vacío de la tabla, si la búsqueda global no devuelve nada, mostrar: *"No se encontró ningún envío con ese tracking. Verificá el número o probá quitar el filtro."* Esto evita la confusión actual donde el usuario asume que el envío fue eliminado.

### 3. Fuera de alcance (sugerencias para después)

- Implementar soft-delete en `envios` (columna `deleted_at` + filtro en todas las queries) para poder "ver eliminados".
- Tabla de auditoría `envios_eliminados` que dispare con un trigger `BEFORE DELETE` y guarde la fila completa + quién la borró. Esto sí permitiría una pestaña "Eliminados" real.

Si querés alguna de esas dos, decímelo y armo un plan dedicado.

## Archivos a modificar

- `src/pages/Shipments.tsx` — agregar input de búsqueda, ajustar `useQuery` (`queryKey` + lógica condicional de filtros), banner de modo búsqueda y estado vacío.

Sin migraciones, sin cambios de backend.
