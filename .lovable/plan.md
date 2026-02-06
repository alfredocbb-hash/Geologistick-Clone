

# Corregir: Escaneo no encuentra envíos en Modo Flex

## Problema detectado

El usuario Ramon Gutierrez (BlackBox Cargas) tiene envíos con tracking numbers que contienen **espacios** en el código de sucursal, por ejemplo: `SUC07 BERA-ENV-20260205-A2F54D`.

Cuando se escanea la etiqueta QR del paquete, el código incluye un sufijo de bulto (ej: `-01`), resultando en `SUC07 BERA-ENV-20260205-A2F54D-01`. La lógica actual para remover ese sufijo utiliza una regex que **no acepta espacios**, por lo que el sufijo no se elimina y la búsqueda exacta en la base de datos falla.

Adicionalmente, la función `addPackageByTracking` en Modo Flex usa coincidencia exacta (`.eq()`) sin ningún mecanismo de fallback, a diferencia de la página de Escaneo normal que usa `.ilike()` con búsqueda parcial.

## Cambios a realizar

### 1. Archivo: `src/lib/qrParser.ts` - Corregir regex de limpieza de sufijo

Actualizar la regex que detecta el formato de tracking con sufijo para aceptar espacios en el código de sucursal. Cambiar de `[A-Z0-9]+` a `[A-Z0-9 ]+` (agregando espacio al character class).

**Antes:**
```text
^[A-Z0-9]+-ENV-\d{8}-[A-Z0-9]+-\d{1,2}$
```

**Despues:**
```text
^[A-Z0-9 ]+-ENV-\d{8}-[A-Z0-9]+-\d{1,2}$
```

### 2. Archivo: `src/hooks/useFlexPackages.ts` - Mejorar la busqueda de tracking

Reemplazar la busqueda exacta (`.eq()`) por una busqueda con `.ilike()` y agregar un fallback de busqueda parcial (removiendo sufijos), tal como hace la pagina ScanQR existente.

**Cambios concretos:**
- Usar `.ilike('tracking_number', tracking)` en vez de `.eq('tracking_number', tracking)` para la busqueda primaria
- Agregar busqueda de fallback con wildcard `%` si la primera no encuentra resultados (removiendo posibles sufijos restantes)
- Cambiar `.single()` por `.maybeSingle()` para evitar errores cuando hay 0 resultados

### Detalle tecnico del flujo corregido

```text
[QR escaneado: "https://geologic.lovable.app/tracking?q=SUC07%20BERA-ENV-20260205-A2F54D-01"]
       |
       v
[parseQRCode extraye: "SUC07 BERA-ENV-20260205-A2F54D-01"]
[Regex CORREGIDA detecta sufijo -01 y lo remueve]
[Resultado: "SUC07 BERA-ENV-20260205-A2F54D"]
       |
       v
[addPackageByTracking busca con ilike]
[Coincidencia encontrada en DB]
       |
       v
[Paquete agregado a la lista Flex]
```

### Impacto

Estos cambios corrigen el problema para:
- Tracking numbers con espacios en el codigo de sucursal (como "SUC07 BERA")
- Tracking numbers con sufijos de bulto que no se limpian correctamente
- Cualquier variacion menor de mayusculas/minusculas en el tracking
