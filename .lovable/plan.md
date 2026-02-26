

# Guardar borrador del formulario de Crear Seller

## Problema

Cuando se esta cargando un nuevo seller y el usuario sale del dialogo (por ejemplo, cambia de pestana o programa), al volver el formulario se resetea y hay que empezar de nuevo.

## Solucion

Integrar el hook `useFormDraft` (que ya existe en el proyecto) con el formulario de `CreateSellerDialog` para guardar automaticamente un borrador en el navegador. Si el usuario vuelve al formulario, se recuperan los datos y se muestra un indicador de "Borrador recuperado".

## Cambios

| Archivo | Cambio |
|---|---|
| `src/components/ecommerce/CreateSellerDialog.tsx` | Integrar `useFormDraft` para persistir los datos del formulario, sincronizar con `react-hook-form` via `form.watch()` y `form.reset()`, y mostrar el indicador `DraftIndicator` cuando hay un borrador recuperado. Limpiar el borrador al guardar exitosamente. |

### Detalle tecnico

1. Usar `useFormDraft('create-seller', defaultValues)` para manejar la persistencia
2. Al abrir el dialogo, si hay borrador recuperado, llamar `form.reset(draftData)` para cargar los valores
3. Usar `form.watch()` para detectar cambios y sincronizarlos con `setFormData` del draft
4. Mostrar `DraftIndicator` en la parte superior del formulario cuando `isDraftRecovered` es true
5. Llamar `clearDraft()` en el `onSuccess` de la mutacion
6. Llamar `discardDraft()` y `form.reset()` cuando el usuario presiona "Descartar" en el indicador

