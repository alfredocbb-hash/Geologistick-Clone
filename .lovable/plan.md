

# Fix: Auto-seleccion de tarifa no funciona en envios Sucursal a Sucursal

## Problema

Cuando un usuario de BlackBox (que tiene activa la feature "auto_seleccion_tarifa_por_zona") crea un envio de tipo **Sucursal a Sucursal** (ej: Berazategui a Rosario), el sistema muestra el error "Ingresa la ciudad del destinatario" en rojo, a pesar de que ya selecciono una sucursal destino.

## Causa raiz

El motor de auto-deteccion de tarifa busca la ciudad en `formData.destinatario_ciudad` (linea 550 de NewShipment.tsx). Pero cuando el tipo de servicio es `sucursal_sucursal`, el usuario no completa una ciudad manualmente -- selecciona una sucursal destino. El campo `destinatario_ciudad` queda vacio, y la tarifa nunca se detecta.

La ciudad de la sucursal destino solo se usa al momento de enviar el formulario (linea 934), pero nunca se copia al campo `destinatario_ciudad` durante la edicion.

## Solucion

Agregar logica en el `useEffect` existente que ya reacciona al cambio de `sucursal_destino_id` (linea 1437-1445) para que tambien copie la ciudad y codigo postal de la sucursal destino a los campos `destinatario_ciudad` y `destinatario_codigo_postal` del formulario. Esto permite que el motor de auto-deteccion de tarifa encuentre la zona correcta.

## Cambio tecnico

| Archivo | Accion | Descripcion |
|---|---|---|
| `src/pages/NewShipment.tsx` | Modificar | En el useEffect de linea 1437, ademas de actualizar coordenadas, copiar `ciudad` y `codigo_postal` de la sucursal destino a `formData.destinatario_ciudad` y `formData.destinatario_codigo_postal` |

El cambio especifico sera en el useEffect existente (lineas 1437-1445):

```text
Antes:
  Solo actualiza destinoCoords con lat/lng de la sucursal destino

Despues:
  Tambien actualiza formData.destinatario_ciudad y formData.destinatario_codigo_postal
  con los datos de la sucursal destino seleccionada
```

No se requieren cambios en la base de datos.
