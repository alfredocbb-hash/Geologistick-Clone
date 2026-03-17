

# Plan: PDF Comercial para nuevos clientes de Geologistick

## Objetivo
Crear un generador de PDF profesional tipo "brochure comercial" que presente Geologistick a posibles nuevos clientes, y agregar un botón de descarga en System Settings (visible para super admin).

## Contenido del PDF (basado en la landing page existente)
1. **Portada** - Logo, nombre, tagline
2. **¿Qué es Geologistick?** - Descripción de la plataforma
3. **Funcionalidades** - Las 9 features (Gestión de Envíos, Tracking, IA, Multi-sucursal, Liquidaciones, Analytics, QR, Notificaciones, White Label)
4. **¿Cómo funciona?** - Los 3 pasos (Regístrate, Configura, Opera)
5. **Planes y Precios** - Consulta dinámica a `subscription_plans` para mostrar planes activos con features y precios
6. **Contacto / CTA** - Email de contacto, invitación a trial

## Cambios

### Nuevo archivo: `src/lib/generateCommercialPDF.ts`
- Función `generateCommercialPDF()` que genera el brochure usando `jsPDF` y los helpers existentes (`loadLogoAsBase64`, `drawCoverPage`, `addPageHeader`, `addPageFooter`, `drawSectionHeader`)
- Contenido hardcoded basado en las features y pasos de la landing
- Sección de precios: recibe opcionalmente planes desde Supabase, o usa texto genérico
- Color primario teal/verde acorde a la marca Geologistick

### Modificar: `src/pages/SystemSettings.tsx`
- Agregar un nuevo Card para "Brochure Comercial" visible solo para super admins
- Botón "Descargar PDF Comercial" que llama a `generateCommercialPDF()`
- Icono `Briefcase` o `Presentation`

| Archivo | Cambio |
|---------|--------|
| `src/lib/generateCommercialPDF.ts` | Nuevo - generador del PDF comercial |
| `src/pages/SystemSettings.tsx` | Agregar card con botón de descarga para super admin |

