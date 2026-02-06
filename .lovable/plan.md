
# Causa raiz: RLS bloquea la entrega porque chofer_id es NULL

## Problema encontrado

Al investigar los datos de la ruta `FLX-20260206-QEWS`, descubri que los 3 envios tienen `chofer_id = NULL`:

```text
ADMIN-ENV-20260206-4AC589  →  chofer_id: NULL  →  estado: en_reparto
ADMIN-ENV-20260206-C19CBA  →  chofer_id: NULL  →  estado: en_reparto
ADMIN-ENV-20260206-0DA651  →  chofer_id: NULL  →  estado: en_reparto
```

La ruta planificada SI tiene el chofer asignado (`f23d3df2...`), pero los envios individuales no.

La politica de seguridad (RLS) para actualizar envios requiere:
```text
tenant_id = tenant_del_usuario 
  AND (es_admin OR chofer_id = usuario_actual)
```

Como `chofer_id` es NULL, la condicion `NULL = usuario_actual` evalua como FALSE, y la base de datos **rechaza silenciosamente** la actualizacion. El chofer toca "Confirmar Entrega" pero la base de datos no hace nada - sin error visible.

## Por que chofer_id es NULL

Hay 2 momentos donde deberia asignarse, y ambos fallan:

1. **Al escanear en Modo Flex** (`handleAutoTransfer`): intenta hacer `UPDATE envios SET chofer_id = user.id` desde el navegador, pero la misma politica RLS lo bloquea porque `chofer_id` es NULL (el chofer no es "dueno" del envio todavia).

2. **Al iniciar la ruta** (`start_ruta_planificada`): esta funcion cambia el estado a `en_reparto` pero **nunca asigna el chofer_id** a los envios. Solo actualiza `estado` y `updated_at`.

## Solucion (3 cambios)

### 1. Corregir la funcion `start_ruta_planificada` (migracion SQL)

Agregar `chofer_id` y `chofer_ultima_milla_id` a las sentencias UPDATE de envios dentro de la funcion. Como esta funcion usa SECURITY DEFINER (no se aplica RLS), puede asignar el chofer_id sin restricciones.

```text
UPDATE envios SET 
  estado = 'en_reparto',
  chofer_id = v_ruta.chofer_id,                          -- NUEVO
  chofer_ultima_milla_id = v_ruta.chofer_id,             -- NUEVO
  fecha_asignacion_ultima_milla = now(),                  -- NUEVO
  updated_at = now()
WHERE ...
```

Esto resuelve el problema principal: al iniciar la ruta, los envios quedan asignados al chofer y las entregas posteriores pasan la verificacion de seguridad.

### 2. Corregir datos existentes (fix inmediato)

Ejecutar un UPDATE para corregir los 3 envios de la ruta actual que ya estan en estado `en_reparto` con `chofer_id` NULL.

### 3. Corregir codigo muerto en `useFlexPackages.ts`

La ultima edicion dejo una linea de codigo inalcanzable (despues de `return null`):

```text
return null;                          // <-- retorna aqui
return await addPackage(envio.id);    // <-- NUNCA se ejecuta (codigo muerto)
```

Remover la linea muerta para evitar posibles errores de compilacion.

### 4. Agregar `tipo_pago` a la consulta de ActiveRouteNavigation

El componente `DeliveryConfirmation` usa `shipment.tipo_pago` para determinar si requiere cobro, pero la consulta en `ActiveRouteNavigation.tsx` no incluye este campo. Agregar `tipo_pago` a las consultas de `enviosHoja` y `paradasRuta`.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Migracion SQL | Recrear `start_ruta_planificada` con asignacion de chofer_id + fix datos actuales |
| `src/hooks/useFlexPackages.ts` | Remover linea de codigo muerto (linea 315) |
| `src/pages/ActiveRouteNavigation.tsx` | Agregar `tipo_pago` a las consultas de envios |

## Detalle tecnico

### Migracion SQL

La funcion `start_ruta_planificada` sera reemplazada con la misma logica pero agregando la asignacion de chofer. Los dos bloques UPDATE existentes (entregas y retiros) se modifican asi:

**Entregas:**
```sql
UPDATE public.envios e
SET estado = 'en_reparto',
    chofer_id = v_ruta.chofer_id,
    chofer_ultima_milla_id = v_ruta.chofer_id,
    fecha_asignacion_ultima_milla = now(),
    updated_at = now()
FROM public.ruta_paradas rp
WHERE rp.ruta_id = p_ruta_id
  AND rp.envio_id = e.id
  AND rp.tipo = 'entrega'
  AND e.estado NOT IN ('entregado', 'devuelto', 'cancelado');
```

**Retiros:**
```sql
UPDATE public.envios e
SET estado_retiro = 'en_camino',
    chofer_id = v_ruta.chofer_id,
    chofer_ultima_milla_id = v_ruta.chofer_id,
    fecha_asignacion_ultima_milla = now(),
    updated_at = now()
FROM public.ruta_paradas rp
WHERE rp.ruta_id = p_ruta_id
  AND rp.envio_id = e.id
  AND rp.tipo = 'retiro'
  AND (e.estado_retiro IS NULL OR e.estado_retiro NOT IN ('retirado', 'fallido'));
```

Ademas, se incluye un fix para los datos actuales:
```sql
UPDATE public.envios e
SET chofer_id = rp2.chofer_id,
    chofer_ultima_milla_id = rp2.chofer_id
FROM public.ruta_paradas rp
JOIN public.rutas_planificadas rp2 ON rp2.id = rp.ruta_id
WHERE rp.envio_id = e.id
  AND e.chofer_id IS NULL
  AND rp2.estado = 'en_curso';
```

### `useFlexPackages.ts` - Linea 315

Remover la linea inalcanzable `return await addPackage(envio.id)` que quedo despues del `return null`.

### `ActiveRouteNavigation.tsx` - Agregar tipo_pago

Agregar `tipo_pago` a las dos consultas de envios (paradas planificadas y envios de hoja de ruta) para que `DeliveryConfirmation` tenga acceso al campo.

## Impacto

| Problema | Causa | Como se resuelve |
|----------|-------|-----------------|
| No marca como entregado | RLS bloquea UPDATE porque chofer_id es NULL | start_ruta_planificada asigna chofer_id al iniciar ruta |
| Foto lleva a pagina principal | APK vieja sin persistencia (ya corregido en codigo web, pendiente rebuild) | Rebuild de APK con server.url |
| Datos actuales rotos | 3 envios en reparto sin chofer_id | Fix directo en migracion SQL |
| Codigo muerto en useFlexPackages | Linea inalcanzable despues de return | Remover linea |
