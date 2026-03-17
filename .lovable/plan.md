

# Plan: Corregir carga de fotos en vista previa y evidencia

## Problema identificado

Hay dos problemas relacionados con la captura de fotos del chofer:

1. **En `DeliveryConfirmation.tsx`**: La lógica de upload ya tiene fallback para usar `photoPreview` (base64) cuando no hay `File`. Sin embargo, en Android WebView, el `onChange` del input puede no dispararse tras la recarga, haciendo que ni `photo` ni `photoPreview` se actualicen con la nueva foto. El preview no se muestra porque el evento nunca llega.

2. **En `ReportIncidentDialog.tsx`**: No hay persistencia en sessionStorage, y el `uploadFile` solo acepta `File` (no `Blob`). Si el WebView recarga, se pierde todo. Además, aunque el usuario seleccione la foto sin recarga, si el `onChange` no se dispara, la foto no se carga.

## Solución

### `DeliveryConfirmation.tsx`
- Agregar un segundo botón visible "Elegir de Galería" que abre el input sin ningún atributo `capture`, dando al usuario una alternativa más estable en Android.
- Asegurar que el input file no tenga `capture` (ya se hizo en el cambio anterior, verificar).

### `ReportIncidentDialog.tsx`
- Agregar persistencia en `sessionStorage` igual que `DeliveryConfirmation` para sobrevivir recargas del WebView.
- Modificar `uploadFile` para aceptar `File | Blob` en vez de solo `File`.
- Agregar fallback: si `photo` es null pero `photoPreview` existe, convertir base64 a Blob y subir.
- Agregar `handleOpenCamera` con persistencia previa a sessionStorage.

### Ambos componentes
- Agregar `capture="environment"` solo en un botón separado de "Cámara" y dejar otro botón "Galería" sin capture. El usuario elige cuál usar.
- **Alternativa mas robusta**: NO usar `capture` en ningún caso. Solo usar `accept="image/*"` y dejar que Android muestre el selector del sistema (cámara + galería). Esto es lo más estable.

## Cambios concretos

| Archivo | Cambio |
|---------|--------|
| `src/components/incidents/ReportIncidentDialog.tsx` | Agregar sessionStorage persistence, cambiar uploadFile a `File | Blob`, agregar fallback dataURL-to-Blob, agregar `handleOpenCamera` |
| `src/components/delivery/DeliveryConfirmation.tsx` | Verificar que no tenga `capture`, sin otros cambios mayores (la lógica ya tiene fallback) |

