

## Verificación: Botón "Importar con IA" en ThirdPartyShipmentsTab

### Estado: Implementado correctamente

El código está bien estructurado:
- **Botón** (línea 631-639): Visible en el header de "Agregar Envío Terciarizado" con icono `Images` y texto "Importar con IA"
- **Estado**: `showBulkOCR` controla la apertura del Dialog
- **Dialog** (línea 1034-1042): Monta `BulkOCRScreen` con invalidación de queries al cerrar
- **Import**: `BulkOCRScreen` y `Dialog` importados correctamente
- **MobileCameraContext**: Tiene valor default, no crashea sin el Provider (funciona en web)

### Problema detectado: Falta DialogTitle (accesibilidad)

El console log muestra el error: `DialogContent requires a DialogTitle for screen reader users`. El Dialog que envuelve BulkOCRScreen no tiene título.

### Corrección necesaria

**`src/components/routes/ThirdPartyShipmentsTab.tsx`** — Agregar `DialogTitle` con `VisuallyHidden` dentro del Dialog:
- Importar `DialogHeader` y `DialogTitle` de `@/components/ui/dialog`
- Agregar un `DialogTitle` oculto visualmente (con `className="sr-only"`) dentro del `DialogContent` para satisfacer la accesibilidad sin afectar el diseño

### Archivos a modificar
- `src/components/routes/ThirdPartyShipmentsTab.tsx` — Agregar DialogTitle oculto al Dialog de BulkOCR

