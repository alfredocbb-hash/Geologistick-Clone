

# Fondo blanco para headers en emails y PDFs

## Problema
El header de los emails y PDFs usa el color primario del tenant como fondo. Cuando el logo del tenant es del mismo color (ej: Beraexpress naranja), el logo no se aprecia.

## Solución
Cambiar todos los headers a **fondo blanco con borde/línea del color primario**, texto oscuro, y el logo visible con sus colores originales.

## Archivos a modificar

### 1. `supabase/functions/send-tenant-email/index.ts` (líneas 99-101)
- Header: `background: #ffffff` + `border-bottom: 3px solid ${branding.color}`
- Título: `color: #18181b` en vez de `#ffffff`

### 2. `src/lib/generateSettlementPDF.ts` (líneas 120-165)
- `drawHeader()`: fondo blanco en vez de `primaryRgb`, texto oscuro, línea inferior con color primario
- Logo y nombre visibles sobre fondo claro

### 3. `src/lib/pdfHelpers.ts`
- `drawCoverPage()` (líneas 87-121): header rect blanco + borde inferior de color primario, texto del nombre en color oscuro, medallón con borde de color en vez de fondo de color
- `drawSectionHeader()` (líneas 170-176): barra blanca con borde inferior de color, texto en color primario

### 4. `src/lib/generateShipmentReceiptPDF.ts`
- El receipt ya usa texto coloreado sobre fondo blanco — sin cambios necesarios (ya está bien)

### 5. `src/lib/exportReportPDF.ts`
- Si usa `drawCoverPage`/`drawSectionHeader` de pdfHelpers, hereda los cambios automáticamente

**Resumen: 3 archivos modificados (email template + settlement PDF + pdfHelpers). Los demás PDFs que usan pdfHelpers heredan el cambio.**

