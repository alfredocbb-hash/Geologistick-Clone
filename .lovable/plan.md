

## Plan: "Planificar" en OCR masivo debe volver al módulo Flex, no al Planificador general

### Problema
Al hacer clic en "PLANIFICAR RUTA" después de procesar fotos en OCR masivo, el sistema navega a `/route-planner` — la vista de administrador. En cambio, debería agregar los paquetes a la lista Flex y volver a la pantalla FlexMixto, donde el chofer puede optimizar, colectar, crear ruta o iniciar reparto.

### Solución

**`src/components/mobile/BulkOCRScreen.tsx`**:
- Agregar un prop `onPackagesReady?: (envioIds: string[]) => void` al componente
- En `handleGoToPlanner`: si existe `onPackagesReady`, llamarlo con los IDs de los paquetes creados en vez de navegar a `/route-planner`. Luego llamar `onClose()`
- Si no existe el callback (fallback), mantener la navegación actual

**`src/components/mobile/FlexMixtoScreen.tsx`**:
- Pasar un callback `onPackagesReady` a `BulkOCRScreen` que:
  1. Recibe los IDs de envíos creados
  2. Los agrega uno por uno a la lista flex usando `addPackage(envioId)` del hook `useFlexPackages`
  3. Cierra el modal de BulkOCR
- Esto hace que los paquetes aparezcan en la lista Flex con los botones de Optimizar, Colectar, Iniciar Reparto, Hoja de Ruta ya disponibles

### Flujo corregido
```text
OCR Masivo → Procesar fotos → "PLANIFICAR"
    ↓
Vuelve a FlexMixto con los paquetes cargados
    ↓
[OPTIMIZAR] [COLECTAR] [INICIAR REPARTO] [HOJA DE RUTA]
```

### Archivos a modificar
- `src/components/mobile/BulkOCRScreen.tsx` — Nuevo prop `onPackagesReady`, lógica condicional en `handleGoToPlanner`
- `src/components/mobile/FlexMixtoScreen.tsx` — Pasar callback que usa `addPackage` del hook

