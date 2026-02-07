
# Corregir mensaje de historial para recogido en sucursal

## Problema

Cuando un paquete pasa de `en_sucursal` a `recogido`, el historial muestra "Paquete retirado del remitente", lo cual es incorrecto. El paquete fue recogido **desde la sucursal**, no del remitente. El trigger debe distinguir el contexto del pickup segun el estado anterior.

## Solucion

Modificar el caso `recogido` en el trigger `log_envio_estado_change` para que sea contextual segun `OLD.estado`:

- Si `OLD.estado = 'en_sucursal'`: el paquete fue recogido desde una sucursal, por lo tanto el mensaje sera: **"Recogido en Sucursal [nombre_sucursal] por [usuario]"**
- En cualquier otro caso (pickup normal desde remitente): **"Paquete recogido del remitente por [usuario]"**

## Cambio tecnico

### Migracion SQL - Actualizar trigger

Modificar la seccion del CASE para `recogido` en la funcion `log_envio_estado_change`:

```text
Antes:
  WHEN NEW.estado = 'recogido' THEN
    'Paquete recogido' || [usuario]

Despues:
  WHEN NEW.estado = 'recogido' THEN
    CASE
      WHEN OLD.estado = 'en_sucursal' THEN
        'Recogido en Sucursal ' || COALESCE(v_suc_actual_nombre, v_suc_origen_nombre, '') ||
        ' por ' || COALESCE(v_usuario_nombre, '')
      ELSE
        'Paquete recogido del remitente' ||
        ' por ' || COALESCE(v_usuario_nombre, '')
    END
```

La variable `v_suc_actual_nombre` ya contiene el nombre de la sucursal del usuario que realiza la accion, y `v_suc_origen_nombre` es la sucursal de origen del envio. De esta forma el mensaje refleja correctamente de donde se recogio el paquete.

### Archivos afectados

| Recurso | Cambio |
|---------|--------|
| Migracion SQL (trigger) | Actualizar la funcion `log_envio_estado_change` con la logica contextual para `recogido` |

No se requieren cambios en el frontend, ya que los componentes de historial (`ShipmentHistoryDialog`, `Tracking`) ya muestran el campo `notas` tal cual viene del trigger.
