

## Plan: Eliminación masiva de envíos para super_admin

### Resumen
Agregar checkboxes de selección múltiple en la tabla de envíos (solo visible para super_admin) con un botón "Eliminar seleccionados" que permite borrar varios envíos a la vez, reutilizando la lógica de `deleteMutation` existente.

### Cambios en `src/pages/Shipments.tsx`

1. **Nuevo estado de selección**:
   - `selectedEnvioIds: Set<string>` para rastrear IDs seleccionados
   - Helpers: `toggleSelectEnvio(id)`, `toggleSelectAll()`, `clearSelection()`

2. **Checkbox en la tabla** (solo si `isSuperAdmin()`):
   - Nueva columna `<TableHead>` con checkbox "seleccionar todos" (sobre los filtrados)
   - Checkbox por fila en `<TableCell>` al inicio de cada row

3. **Barra de acciones masivas**:
   - Visible cuando hay envíos seleccionados: muestra cantidad seleccionada + botón "Eliminar seleccionados" (destructive)
   - Botón "Deseleccionar todo"

4. **Mutación masiva `bulkDeleteMutation`**:
   - Itera sobre los IDs seleccionados ejecutando la misma lógica de borrado que `deleteMutation` (eliminar historial, detalles, comisiones, pagos, movimientos, paradas, hojas de ruta, desenlazar orders, y finalmente borrar envío)
   - Muestra progreso via toast
   - Al finalizar invalida queries y limpia selección

5. **Diálogo de confirmación masiva**:
   - `bulkDeleteDialogOpen` state
   - Muestra cantidad de envíos a eliminar con advertencia clara de irreversibilidad
   - Requiere confirmación antes de ejecutar

### Importaciones adicionales
- `Checkbox` de `@/components/ui/checkbox`

### Archivos a modificar
- `src/pages/Shipments.tsx`

