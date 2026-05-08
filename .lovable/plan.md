# Fix: Reprogramar envío falla en la APK

## Causa raíz

La función `reschedule_envio` hace este cast:

```sql
estado = v_new_estado::estado_envio
```

Pero el tipo enum en la base se llama **`shipment_status`** (no `estado_envio`). Por eso al ejecutar la reprogramación PostgreSQL devuelve un error de tipo y el toast en la APK muestra "Error al reprogramar".

Verificado:
- La columna `envios.estado` usa `udt_name = shipment_status`
- El tipo `estado_envio` no existe en la base
- El enum `shipment_status` ya incluye `reprogramado` ✓ (no hace falta tocar el enum)

## Cambio propuesto

Migración para reemplazar la función `reschedule_envio` casteando al tipo correcto:

- Cambiar `v_new_estado::estado_envio` por `v_new_estado::shipment_status`
- Mantener intacto el resto de la lógica (estado `reprogramado` para envíos ML en reparto/visitas, `pendiente` en otros casos, desasignación de chofer cuando vuelve a pendiente, marcar `ruta_paradas` como reprogramado, e insertar historial).

No hay cambios en frontend ni en otras tablas.

## Validación

Después de aplicar la migración: probar reprogramar desde la APK un envío en `en_reparto`. Debe quedar en `reprogramado` (si es ML) o `pendiente` (si no), con el toast "Entrega reprogramada correctamente".
