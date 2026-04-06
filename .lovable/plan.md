

## Plan: Fix 404 al planificar desde "Importar con IA" en escritorio

### Problema
Cuando el usuario procesa fotos desde el dialog "Importar con IA" en el planificador (ruta `/planner`), al hacer click en "Planificar Ruta", el componente `BulkOCRScreen` ejecuta `navigate('/route-planner')` — que es la ruta **mobile**. En desktop la ruta correcta es `/planner`, causando un 404.

### Solucion
En `BulkOCRScreen.tsx`, cuando se ejecuta desde desktop (sin `onPackagesReady`), navegar a `/planner` en vez de `/route-planner` segun `isMobile`. Mejor aun: cuando el componente se abre dentro del planificador (desktop), simplemente cerrar el dialog e invalidar queries en vez de navegar, ya que el usuario ya esta en la pagina correcta.

### Cambio concreto

**`src/components/mobile/BulkOCRScreen.tsx`** — En la funcion que maneja "Planificar Ruta" (linea ~269):
- Si `onPackagesReady` no existe y estamos en desktop (`!isMobile`), usar `navigate('/planner?envio_ids=...')` en vez de `/route-planner?envio_ids=...`
- Alternativa mas limpia: detectar con `isMobile` y usar la ruta correcta para cada plataforma

### Archivos a modificar
- `src/components/mobile/BulkOCRScreen.tsx` — Cambiar la ruta de navegacion segun plataforma (linea 269)

