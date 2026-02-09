

# Generar PDF de Homologacion para Tiendanube

## Alcance

Crear el archivo `src/lib/generateHomologacionPDF.ts` y agregar un boton en `IntegrationSettings.tsx` (solapa Tiendanube) para descargar el documento.

## Archivos a crear / modificar

### 1. Nuevo archivo: `src/lib/generateHomologacionPDF.ts`

Seguira exactamente el mismo patron de `generateEcommerceGuidePDF.ts`:

- Importa `jsPDF` y los helpers compartidos de `pdfHelpers.ts` (`loadLogoAsBase64`, `addPageHeader`, `addPageFooter`, `drawCoverPage`, `drawSectionHeader`)
- Define una constante `HOMOLOGACION_CONTENT` con las 10 secciones proporcionadas por el usuario
- Color primario: `[47, 84, 150]` (Azul Tiendanube #2F5496)
- Exporta la funcion `generarHomologacionPDF()`
- Genera: portada, indice, y cada seccion con su header de color y contenido renderizado con word-wrap

**Estructura del contenido (10 secciones):**

1. Informacion General de la Aplicacion
2. Flujo OAuth 2.0 (descripcion secuencial paso a paso)
3. Endpoints Implementados (5 funciones)
4. Webhooks Registrados (5 eventos incluyendo app/uninstalled)
5. Seguridad (HMAC-SHA256, tokens, renovacion, limpieza)
6. GDPR / Privacidad (3 eventos reconocidos)
7. Transportista (registro automatico, tipos de envio)
8. Ciclo de Vida (instalacion, desinstalacion, reinstalacion)
9. URLs y Configuracion Tecnica (todas las URLs reales)
10. Contacto e Informacion del Desarrollador

**Nombre del archivo descargado:** `homologacion-geologistick-tiendanube.pdf`

### 2. Modificar: `src/pages/IntegrationSettings.tsx`

Agregar un boton "Descargar Documento de Homologacion" en la solapa de Tiendanube, debajo de la seccion de Webhook URL. El boton:

- Importa `generarHomologacionPDF` del nuevo archivo
- Muestra icono `FileText` + texto descriptivo
- Llama a `generarHomologacionPDF()` al hacer clic
- Muestra estado de carga mientras genera el PDF

## Sin dependencias nuevas

Todo se implementa con `jsPDF` (ya instalado) y los helpers existentes en `pdfHelpers.ts`.

