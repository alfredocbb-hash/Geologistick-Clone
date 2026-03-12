

# Abrir cámara directamente desde la APK para fotos

## Problema

En `DeliveryConfirmation.tsx`, el input de archivo usa `accept="image/*"` pero le falta el atributo `capture="environment"`, lo que hace que Android muestre un selector de archivos en vez de abrir la cámara directamente. El componente `ReportIncidentDialog.tsx` ya lo tiene correctamente.

## Cambio

**Archivo: `src/components/delivery/DeliveryConfirmation.tsx`** (línea 569)

Agregar `capture="environment"` al `<input type="file">` existente:

```html
<!-- Antes -->
<input type="file" accept="image/*" ... />

<!-- Después -->
<input type="file" accept="image/*" capture="environment" ... />
```

El atributo `capture="environment"` le indica al WebView de Android que abra directamente la cámara trasera del dispositivo, sin pasar por el selector de archivos.

Un solo cambio de una línea en un archivo.

