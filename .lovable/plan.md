

## Plan: Imágenes Promocionales Geologistick + Página de Marketing

### Objetivo
Generar 6 imágenes promocionales en 3 formatos (Post 1080x1080, Story 1080x1920, Banner WhatsApp 1200x630) y crear una página en la app para verlas y descargarlas.

### Paleta de marca detectada
- **geo-dark**: `hsl(210, 60%, 15%)` → `#0F2942`
- **geo-teal**: `hsl(174, 50%, 50%)` → `#40BFA6`  
- **geo-blue**: `hsl(207, 50%, 35%)` → `#2D6A8F`
- **geo-cyan**: `hsl(187, 70%, 45%)` → `#22A3B3`
- Logo: pin con paquete sobre fondo oscuro

### Temas de las 6 imágenes
1. **Hero/General** — "Logística inteligente para tu empresa" (logo central, gradiente de marca)
2. **Tracking en tiempo real** — "Rastreá tus envíos en tiempo real" (icono mapa/pin)
3. **App móvil** — "Tu operación desde el celular" (mockup mobile)
4. **Ecommerce** — "Conectá tu tienda online" (iconos integración)
5. **Optimización de rutas** — "Rutas optimizadas con IA" (iconos rutas)
6. **Reportes y liquidaciones** — "Métricas y liquidaciones automáticas" (iconos gráficos)

### Paso 1: Generar imágenes con AI (script)
- Usar el AI image generation gateway (`google/gemini-3-pro-image-preview`) para generar las 6 imágenes en formato Post (1080x1080)
- Luego generar versiones Story y Banner adaptando composición
- Guardar todo en `/mnt/documents/geologistick-promo/`

### Paso 2: Nueva página `/marketing-assets`
Crear `src/pages/MarketingAssets.tsx`:
- Grid con las 6 imágenes en preview
- Selector de formato (Post / Story / Banner)
- Botón de descarga individual y descarga masiva
- Accesible desde SystemSettings o como ruta directa

### Paso 3: Almacenamiento
- Subir las imágenes generadas a un bucket de storage (`marketing-assets`, público)
- La página las carga desde el bucket

### Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| Script de generación | Generar 6×3 = 18 imágenes con AI gateway |
| Migración SQL | Crear bucket `marketing-assets` |
| `src/pages/MarketingAssets.tsx` | **Nuevo** - galería con descarga |
| `src/App.tsx` | Agregar ruta `/marketing-assets` |
| `src/pages/SystemSettings.tsx` | Agregar card para acceder a Marketing Assets |

### Nota importante
Las imágenes se generarán con IA usando el logo y la paleta de marca de Geologistick. Cada imagen tendrá un diseño profesional con el branding consistente (colores teal/dark/cyan, logo, tipografía limpia). Primero genero las imágenes descargables y luego construyo la página en la app.

