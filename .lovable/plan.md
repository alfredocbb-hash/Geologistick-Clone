

# Plan: Usar Capacitor Camera para captura estable de fotos

## Diagnóstico

La app del chofer es una **app Capacitor** que carga desde `geologic.lovable.app`. El problema de fondo es que los `<input type="file" capture="environment">` en un WebView de Android son inherentemente inestables: al abrir la cámara, el WebView puede recargarse y perder el evento `onChange`, haciendo que la foto nunca llegue al preview.

**Dato importante**: La Capacitor config apunta a la URL publicada (`geologic.lovable.app`). Si no se publicó la última versión, el chofer sigue viendo el código viejo con un solo botón. Pero incluso con los cambios publicados, el problema de `capture="environment"` puede persistir en muchos dispositivos Android.

## Solución: `@capacitor/camera`

Dado que ya es una app Capacitor, la solución correcta es usar el **