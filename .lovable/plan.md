

## Plan: Sincronización ML en tiempo real + filtrar choferes inactivos en Mapa en Vivo

### Contexto

Hay dos problemas a resolver:

1. **Sincronización ML**: Ya existe un trigger `auto_sync_ml_status` en la tabla `envios` que llama automáticamente a `mercadolibre-update-status` cuando cambia el estado. Sin embargo, el Mapa en Vivo no refleja los cambios en tiempo real porque `ruta_paradas` y `envios` no tienen suscripciones realtime. El plan previo (aprobado pero no implementado) ya cubría esto.

2. **Choferes inactivos**: La query actual en LiveMap obtiene usuarios con rol `chofer` desde `user_roles`, pero no filtra por `profiles.activo = true`. Esto muestra choferes desactivados en el mapa.

### Cambios

**Migración SQL** — Habilitar realtime en `ruta_paradas` y `envios`:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.ruta_paradas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.envios;
```

**`src/pages/LiveMap.tsx`**:

1. **Filtrar choferes inactivos**: En la query `driver-locations`, después de obtener los `validChoferIds` de `user_roles`, obtener perfiles activos y filtrar por `activo = true`:
   - Agregar query a `profiles` con `.in('user_id', validChoferIds).eq('activo', true)` para obtener solo los IDs de choferes activos.
   - Usar esos IDs filtrados para la query de `driver_locations`.

2. **Suscripción realtime a `ruta_paradas` y `envios`**: Agregar un segundo canal de Supabase que escuche cambios en ambas tablas y al recibir un evento:
   - Invalidar `['driver-route-progress']` para actualizar barras de progreso inmediatamente.
   - Invalidar `['sucursales-live-map']` para actualizar contadores de envíos.

### Resultado esperado

- Los choferes marcados como inactivos (`activo = false`) no aparecen en el mapa ni en la lista.
- Cuando un chofer entrega un envío ML desde la app móvil, el trigger `auto_sync_ml_status` ya sincroniza con ML automáticamente, y ahora el mapa reflejará el cambio de estado al instante gracias a la suscripción realtime.

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Habilitar realtime en `ruta_paradas` y `envios` |
| `src/pages/LiveMap.tsx` | Filtrar choferes por `activo = true` + suscripción realtime a `ruta_paradas`/`envios` |

