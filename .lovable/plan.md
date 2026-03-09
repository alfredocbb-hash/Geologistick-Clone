

# Alerta de cliente existente al crear envío

## Enfoque

Agregar una verificación automática cuando el usuario llena el campo de **teléfono** (remitente o destinatario). Si se encuentra un cliente existente en la base de datos, mostrar un `AlertDialog` preguntando si desea cargar los datos guardados en el formulario.

Esto también resuelve el bug de `.maybeSingle()` con duplicados agregando `.limit(1)`.

## Cambios

### `src/pages/NewShipment.tsx`

1. **Nuevo estado**: `pendingClientMatch` para guardar el cliente encontrado y el campo destino (remitente/destinatario).

2. **Función `checkExistingClient`**: Se ejecuta en `onBlur` del campo teléfono (remitente y destinatario). Busca por teléfono con `.limit(1).maybeSingle()`. Si encuentra coincidencia, guarda en `pendingClientMatch` y abre el `AlertDialog`.

3. **AlertDialog**: Muestra los datos del cliente encontrado (nombre, dirección, teléfono). Si el usuario acepta, autocompleta los campos del formulario (nombre, apellido, email, dirección, ciudad, CP, DNI). Si rechaza, no hace nada y permite continuar con los datos manuales.

4. **Fix `.maybeSingle()`**: En `findOrCreateClient`, agregar `.limit(1)` antes de cada `.maybeSingle()` para evitar el error PGRST116 con clientes duplicados.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/NewShipment.tsx` | Agregar estado, función de verificación onBlur, AlertDialog, y fix `.limit(1)` en `findOrCreateClient` |

