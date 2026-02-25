

# PDF Guia Operativa Envios Flex + WhatsApp

## Resumen

Crear un PDF descargable "Guia Operativa Envios Flex" que use la identidad visual del tenant (logo, nombre, colores) en lugar del logo generico de Geologistick. Incluir opcion de compartir por WhatsApp.

## Contenido del PDF

- **Portada**: Logo del tenant, nombre del tenant (ej: "BeraExpress"), subtitulo "Guia Operativa Envios Flex"
- **Seccion 1 - Proceso de Onboarding**: Apertura de cuenta, sincronizacion con 2 links, autorizacion
- **Seccion 2 - Horarios y Logistica de Retiro**: Corte 12:00hs, retiro 12:10-13:00hs, bonificacion desde 5 pedidos
- **Seccion 3 - Tarifario Vigente**: Tabla con Zona 1 (Berazategui $4,610.99), Zona 2 (Quilmes/F.Varela $7,370.99), Zona 3 (CABA $10,245.99)

## Cambios tecnicos

| Archivo | Accion | Descripcion |
|---|---|---|
| `src/lib/generateFlexGuidePDF.ts` | Crear | Funcion que recibe datos de branding del tenant (logo, nombre, color primario) y genera el PDF con portada personalizada usando `pdfHelpers.ts`. Carga el logo del tenant desde la URL almacenada en `tenant_branding` via canvas para compatibilidad con jsPDF |
| `src/pages/SystemSettings.tsx` | Modificar | Agregar nueva Card con icono Truck. Importar `useTenantContext` para obtener el branding del tenant actual y pasarlo a la funcion de generacion. Dos botones: "Descargar" y "Enviar por WhatsApp" |

### Detalle de generacion del PDF

La funcion `generateFlexGuidePDF` recibira un objeto con:

```text
{
  tenantName: string       // ej: "BeraExpress"
  logoUrl: string | null   // URL del logo del tenant desde tenant_branding.logo_light
  primaryColor: string     // Color primario hex del tenant
}
```

Internamente:
1. Carga el logo del tenant via canvas (patron de `generateSettlementPDF.ts`) para convertir SVG/CORS a base64
2. Usa `drawCoverPage` con el nombre del tenant como titulo principal y color primario del tenant
3. Dibuja las 3 secciones con texto formateado
4. Dibuja la tabla del tarifario con `doc.rect()` y `doc.text()`
5. Guarda como `{tenantName}-Guia-Flex.pdf`

### Detalle de la Card en SystemSettings

- Importar `useTenantContext` y `Truck` de lucide
- Estado `isGeneratingFlexPDF`
- Handler `handleDownloadFlexGuide`: obtiene branding del tenant context y llama a `generateFlexGuidePDF`
- Handler `handleShareFlexWhatsApp`: descarga el PDF y abre `https://wa.me/?text=...` con mensaje pre-armado incluyendo el nombre del tenant
- Color de icono: amarillo (identidad ML Flex)

### Flujo de WhatsApp

1. Se genera y descarga el PDF localmente
2. Se abre WhatsApp con mensaje pre-cargado: "Hola! Te comparto la Guia Operativa de Envios Flex de {tenantName}. Por favor revisa el archivo adjunto."
3. El usuario adjunta manualmente el PDF descargado al chat

No se requieren cambios en la base de datos.

