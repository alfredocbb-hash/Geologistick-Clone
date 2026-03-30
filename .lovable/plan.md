

## Plan: Marcadores por color de seller en el Planificador de Rutas

### Objetivo
Diferenciar visualmente en el mapa los envíos de cada seller/remitente con un color distinto, y agregar una leyenda dinámica debajo del mapa con el nombre de cada seller y su color asignado.

### Cambios

**1. `src/components/maps/MapView.tsx`** — Soporte para color personalizado en markers
- Agregar propiedad opcional `customIconUrl?: string` al `MarkerInfo` interface
- En el render de `Marker`, si `customIconUrl` está presente usarlo en lugar de `getMarkerIcon()`

**2. `src/pages/RoutePlanner.tsx`** — Asignar colores por seller y renderizar leyenda

- **Paleta de colores**: definir un array de ~10 colores distinguibles (rojo, azul, violeta, naranja, gris, verde oscuro, rosa, marrón, cyan, etc.)
- **Mapeo seller→color**: en un `useMemo`, extraer los `nombre_remitente` únicos de `selectedEnviosData` (solo entregas, no retiros). Asignar un color a cada seller por orden de aparición.
- **Markers**: al construir `mapMarkers`, para envíos de tipo `entrega`, generar un marker SVG inline con el color del seller usando `google.maps.SymbolPath.CIRCLE` o un Data URI SVG coloreado, y pasarlo como `customIconUrl`
- **Leyenda dinámica**: debajo de la leyenda estática existente (Origen / Sucursales / Retiros / Entregas), agregar una sección con los sellers y sus colores, solo si hay más de un seller. Formato: punto de color + nombre del seller

### Detalle técnico del marker coloreado

Para generar iconos de color dinámico sin depender de URLs externas, se usará un SVG inline codificado como Data URI:

```typescript
const createColoredMarkerUrl = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="12" fill="${color}" stroke="white" stroke-width="2"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};
```

### Archivos a modificar
- `src/components/maps/MapView.tsx` (agregar `customIconUrl` al interface + usarlo)
- `src/pages/RoutePlanner.tsx` (mapeo de sellers→colores, markers coloreados, leyenda)

