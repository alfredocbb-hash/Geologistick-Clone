## Selector de fecha en OCR Masivo (Planificador → Terciarizados)

### Objetivo
Permitir que al subir imágenes vía OCR Masivo desde el escritorio (Planificador → Terciarizados → "Importar Fotos con IA"), el usuario pueda elegir la fecha con la que se registrarán los envíos. Por defecto se ofrece la fecha de hoy, pero se puede modificar a cualquier día anterior (caso típico: cargar el lunes pedidos que llegaron el sábado).

### Comportamiento

- En la cabecera del modo Álbum (escritorio) aparece un selector de fecha junto al título **"Importar Fotos con IA"**.
- Valor por defecto: **hoy**.
- Permite seleccionar cualquier fecha **≤ hoy** (no fechas futuras).
- La fecha elegida se aplica a **todos los envíos** procesados en esa sesión OCR.
- El selector queda deshabilitado durante el procesamiento y la fase final (`done`) para evitar inconsistencias.
- En mobile se mantiene el comportamiento actual (siempre fecha de hoy) — el ajuste es exclusivo del flujo escritorio del Planificador → Terciarizados.

### Cambios técnicos

**`src/components/mobile/BulkOCRScreen.tsx`**
- Nuevo estado `fechaIngreso: Date` (inicializado a `new Date()`).
- Renderizar un Popover + `Calendar` (shadcn) en la cabecera del modo Álbum, visible solo cuando `!isMobile`.
- En los **3 puntos de inserción a `envios`** (OCR álbum estándar, force-save de duplicados, y guardado manual), enviar `created_at: fechaIngreso.toISOString()` para que el envío quede registrado con la fecha seleccionada.
- El modo Ráfaga (mobile-only) no se modifica.

### Consideraciones
- La columna `created_at` admite el override desde el cliente (ya se hace en el seed de demo).
- No se modifican triggers ni la base de datos.
- Los reportes y filtros por fecha de creación reflejarán la fecha elegida por el usuario.