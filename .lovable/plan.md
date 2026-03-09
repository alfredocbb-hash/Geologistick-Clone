

# Fix: Validación de cliente duplicado y error al seleccionar cliente existente

## Problemas identificados

### Problema 1: Validación por teléfono es incorrecta
`checkExistingClient` (línea 557) busca duplicados solo por teléfono. Múltiples clientes pueden compartir el mismo número, generando falsos positivos. La validación correcta debe usar **nombre + apellido + DNI**.

### Problema 2: Seleccionar cliente desde ContactAutocomplete sigue fallando
Cuando el usuario selecciona un cliente desde el autocomplete (`handleLoadSenderClient` / `handleLoadRecipientClient`), se cargan los datos en el formulario. Pero luego, al hacer blur en el campo teléfono, `checkExistingClient` se dispara de nuevo mostrando el AlertDialog innecesariamente. Además, `findOrCreateClient` sigue buscando por teléfono primero (línea 912), encontrando un cliente diferente al seleccionado, y puede fallar al intentar crear uno nuevo si ya existe por nombre+dirección.

## Cambios en `src/pages/NewShipment.tsx`

### 1. Cambiar `checkExistingClient` para validar por nombre+apellido+DNI
- Ya no se dispara en `onBlur` del teléfono
- Se dispara en `onBlur` del campo **DNI** (remitente y destinatario)
- Busca por combinación de `nombre + apellido + dni_cuit` (los 3 si están disponibles, o nombre+dni como mínimo)
- Si no hay DNI, no se valida (el teléfono no es criterio de unicidad)

### 2. Cambiar el orden de búsqueda en `findOrCreateClient`
- Prioridad 1: Buscar por **nombre + apellido + DNI** (si hay DNI)
- Prioridad 2: Buscar por **nombre + dirección** (índice único existente)
- Eliminar la búsqueda por teléfono como criterio de identificación (el teléfono no es único)
- Mantener `.limit(1).maybeSingle()` en todas las consultas

### 3. Agregar flag para evitar alert redundante al cargar cliente
- Agregar un flag `clientLoadedManually` que se activa cuando el usuario selecciona un cliente desde `ContactAutocomplete`
- Si el flag está activo, `checkExistingClient` no se dispara (el cliente ya fue seleccionado manualmente)
- El flag se resetea cuando el usuario modifica manualmente el nombre o DNI

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/NewShipment.tsx` | Refactor `checkExistingClient` para usar nombre+apellido+DNI; reordenar búsquedas en `findOrCreateClient` eliminando teléfono como criterio; agregar flag anti-redundancia |

