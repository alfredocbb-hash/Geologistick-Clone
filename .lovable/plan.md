

## Plan: BulkOCRScreen funcione en escritorio con selector de archivos

### Problema
El componente `BulkOCRScreen` esta disenado 100% para movil (pantalla completa negra, camara, video). Cuando se abre desde el escritorio via "Importar con IA" en ThirdPartyShipmentsTab, muestra la interfaz de camara movil que no funciona en desktop.

### Solucion

**`src/components/mobile/BulkOCRScreen.tsx`** — Detectar si estamos en desktop y adaptar el flujo:

1. **Importar `useIsMobile`** y detectar si estamos en desktop
2. **En desktop, saltar la pantalla de seleccion de modo** ("select") y ir directo al modo album
3. **Reemplazar el boton de camara por un `<input type="file" accept="image/*" multiple />`** que permite seleccionar multiples imagenes del sistema de archivos
4. **Al seleccionar archivos**, convertirlos a dataUrl y agregarlos a `albumPhotos` automaticamente
5. **Adaptar el layout**: en desktop no usar `fixed inset-0` sino un contenedor normal que funcione dentro del Dialog del padre; quitar estilos de pantalla completa oscura cuando es desktop
6. **Mantener el resto del flujo igual**: grid de fotos, boton PROCESAR, edicion manual de errores, PLANIFICAR

### Cambios concretos en el componente:
- Nueva funcion `handleFileSelect(e: ChangeEvent<HTMLInputElement>)` que lee archivos con FileReader y los agrega como albumPhotos
- En desktop: el mode arranca en `'album'` directamente, no muestra la pantalla "select"
- En la vista de album en desktop: boton "Seleccionar Imagenes" con input file en vez de boton de camara
- El contenedor principal usa clases condicionales: `fixed inset-0 bg-slate-950` en movil, layout normal en desktop

### Archivos a modificar
- `src/components/mobile/BulkOCRScreen.tsx` — Agregar deteccion desktop + input file + layout adaptativo

