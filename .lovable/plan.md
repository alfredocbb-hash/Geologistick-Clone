

## Plan: Botón "Geolocalizar Todos" en el Planificador de Rutas

### Problema
Cuando hay muchos envíos sin coordenadas, el usuario debe geolocalizar uno por uno haciendo clic en cada envío. Esto es lento y tedioso.

### Solución
Agregar un botón "Geolocalizar Todos" en la sección amarilla de "Envíos sin geolocalizar" que procese todos los envíos pendientes en lote, con barra de progreso y manejo de errores.

### Cambio técnico

**Archivo: `src/pages/RoutePlanner.tsx`**

1. Agregar estado para tracking del progreso:
   - `geocodingProgress: { current: number; total: number } | null`

2. Agregar función `geocodeAllEnvios`:
   - Filtra envíos sin coordenadas del `selectedEnviosData`
   - Itera secuencialmente (para no saturar la API) con un delay de 300ms entre llamadas
   - Reutiliza la misma lógica de `geocodeEnvio` (dirección, ciudad, update en DB)
   - Muestra progreso en tiempo real y toast final con resumen (X exitosos, Y fallidos)
   - Al terminar, invalida queries una sola vez

3. En la UI (sección amarilla, línea ~1819):
   - Agregar botón "Geolocalizar Todos (N)" junto al título
   - Mostrar barra de progreso cuando `geocodingProgress` no es null
   - Deshabilitar botón mientras está procesando

### Resultado
Un solo clic geolocaliza todos los envíos pendientes con feedback visual de progreso.

