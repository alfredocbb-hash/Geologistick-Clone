

# Fix: Alert "Cliente encontrado" al crear envío con cliente ya seleccionado

## Problema

Cuando el usuario selecciona un cliente existente desde el autocompletado (ContactAutocomplete), al hacer click en "Crear Envío" se dispara el `onBlur` del campo DNI, que ejecuta `checkExistingClient`. Si en algún momento se editó cualquier campo del formulario que haya reseteado el flag `clientLoadedManually`, la función encuentra al mismo cliente que ya fue cargado y muestra el AlertDialog "Cliente encontrado", bloqueando la creación del envío.

## Causa raíz

El `onChange` del input de DNI (líneas 2106 y 2274) resetea `clientLoadedManually` a `false` cada vez que el valor cambia, incluso si fue cambiado programáticamente o si el usuario tocó el campo sin intención de buscar otro cliente. Al hacer click en "Crear Envío", el `onBlur` del campo DNI se dispara y `checkExistingClient` ya no tiene el flag de protección.

## Solución

En `checkExistingClient`, agregar una segunda capa de protección: si los datos del cliente encontrado (nombre + DNI + dirección) coinciden con los que ya están en el formulario, no mostrar el alert porque es el mismo cliente que ya está cargado.

### `src/pages/NewShipment.tsx` — función `checkExistingClient` (líneas 560-585)

Agregar después de encontrar el cliente (línea 582):

```typescript
if (found) {
  // Si los datos ya coinciden con el formulario, es el mismo cliente cargado — no alertar
  const currentName = target === 'remitente' ? formData.remitente_nombre?.trim() : formData.destinatario_nombre?.trim();
  const currentDir = target === 'remitente' ? formData.remitente_direccion?.trim() : formData.destinatario_direccion?.trim();
  
  if (
    found.nombre?.toLowerCase() === currentName?.toLowerCase() &&
    found.direccion?.toLowerCase() === currentDir?.toLowerCase()
  ) {
    return; // Same client already in form, skip alert
  }
  
  setPendingClientMatch({ client: found as Client, target });
}
```

## Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/NewShipment.tsx` | Agregar comparación en `checkExistingClient` para evitar alertar si el cliente encontrado ya es el que está cargado en el formulario |

