
## Causa raíz

El error `"No se pudo crear ni encontrar el cliente"` en el tenant **Beraexpress** ocurre por una inconsistencia entre el **índice único** de `clientes` y el **fallback de búsqueda** en `findOrCreateClient` (líneas 1017-1046 de `src/pages/NewShipment.tsx`).

- El índice único es: `(tenant_id, lower(trim(nombre)), lower(trim(direccion)))` — **normaliza con TRIM**.
- El fallback usa: `.ilike('nombre', data.nombre.trim()).ilike('direccion', data.direccion.trim())` — **busca exact match case-insensitive sin wildcards**, pero NO compara contra valores trimmed en la base.

En la BD de Beraexpress hay decenas de clientes legacy con **espacios trailing** en `nombre` (ej: `"ALEJO "`, `"YANINA "`, `"JUST "`, `"NICOLAS "`, etc.). Cuando el usuario intenta crear un envío con `nombre="ALEJO"`:
1. El INSERT choca con el índice único (porque `trim("ALEJO ")` = `trim("ALEJO")`).
2. El fallback `ilike('nombre', 'ALEJO')` no encuentra `"ALEJO "` (con espacio).
3. Se lanza el error genérico al usuario.

## Solución

Hacer el fallback de recuperación **tolerante a whitespace** y agregar como segundo recurso una búsqueda con wildcards. Tres cambios mínimos en `findOrCreateClient` (`src/pages/NewShipment.tsx`):

| Lugar | Cambio |
|---|---|
| Búsqueda inicial por nombre+dirección (líneas 957-988) | Reemplazar `ilike('nombre', data.nombre.trim())` por `ilike('nombre', \`%${data.nombre.trim()}%\`)` y mismo en `direccion`, filtrando luego por match exacto sobre valores trimmed en JS para evitar falsos positivos. |
| Fallback dentro del bloque 23505 (líneas 1022-1033) | Misma lógica con wildcards + filtro JS. Además, agregar fallback adicional buscando por `tenant_id` + nombre con wildcard si el primer intento no encuentra. |
| Limpieza preventiva (opcional) | Migración SQL one-shot para `UPDATE clientes SET nombre = trim(nombre), direccion = trim(direccion), apellido = trim(apellido)` para todos los tenants — elimina la causa raíz a futuro. |

### Esbozo del fallback corregido

```ts
// Helper que busca con wildcard y luego filtra por match exacto trimmed/lowercase
const findByNameAddr = async (nombre: string, direccion: string) => {
  const { data: candidates } = await supabase
    .from('clientes')
    .select('id, nombre, direccion')
    .ilike('nombre', `%${nombre.trim()}%`)
    .ilike('direccion', `%${direccion.trim()}%`)
    .limit(20);
  return candidates?.find(c =>
    c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase() &&
    c.direccion.trim().toLowerCase() === direccion.trim().toLowerCase()
  );
};
```

Este helper se usa tanto en la búsqueda inicial (paso 2) como en el fallback del bloque 23505.

### Migración recomendada

```sql
-- Limpiar whitespace existente en clientes (one-shot)
UPDATE clientes
SET nombre = trim(nombre),
    apellido = trim(apellido),
    direccion = trim(direccion)
WHERE nombre <> trim(nombre)
   OR apellido <> trim(apellido)
   OR direccion <> trim(direccion);
```

Esto previene que el mismo problema vuelva a aparecer en otros flujos (búsquedas, dropdowns, etc.).

## Riesgo
Bajo. El cambio en `findOrCreateClient` solo afecta el camino de recuperación (no rompe casos que ya funcionan). La migración solo normaliza datos sin borrar nada — y como `trim` es idempotente, repetirla es seguro.

## Verificación
1. En Beraexpress, abrir Nuevo Envío y cargar un destinatario cuyo nombre exista con espacio trailing (ej. "ALEJO" con dirección Av. 14 3875). Confirmar que el envío se crea sin el error.
2. Repetir con un cliente totalmente nuevo para asegurar que el flujo de creación normal sigue funcionando.
