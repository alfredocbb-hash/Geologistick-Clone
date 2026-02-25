

# PDF Terminos y Condiciones del Servicio Flex

## Resumen

Crear un nuevo PDF descargable "Terminos y Condiciones del Servicio de Logistica Flex" con branding dinamico del tenant (logo, nombre, color primario), y agregar una nueva Card en la pagina de Configuracion del Sistema con botones de descarga y envio por WhatsApp.

## Contenido del PDF

El documento incluira portada con branding del tenant y las siguientes secciones:

1. **Tarifas y Facturacion** - Precios netos sin IVA, facturacion con 21% adicional
2. **Operatoria de Entregas y Visitas** - 2 intentos incluidos, tercer intento con costo adicional
3. **Liquidaciones y Terminos de Pago** - Liquidacion semanal, plazo 48hs habiles, mora del 5%
4. **Compromiso de Servicio** - Esfuerzos para cumplir tiempos Flex, seguridad y comunicacion

## Cambios tecnicos

| Archivo | Accion | Descripcion |
|---|---|---|
| `src/lib/generateFlexTermsPDF.ts` | Crear | Nueva funcion que genera el PDF de terminos y condiciones usando `pdfHelpers.ts`. Recibe el mismo objeto de branding que `generateFlexGuidePDF` (tenantName, logoUrl, primaryColor). Usa el color primario del tenant para encabezados de seccion y portada. Incluye texto legal formateado con subsecciones numeradas |
| `src/pages/SystemSettings.tsx` | Modificar | Agregar nueva Card con icono `Scale` (o `FileCheck`) de lucide-react. Estado `isGeneratingFlexTermsPDF`. Dos botones: "Descargar" y "WhatsApp", siguiendo el mismo patron de la Card de Guia Flex existente |

### Detalle del PDF

La funcion `generateFlexTermsPDF` recibira:

```text
{
  tenantName: string       // ej: "BeraExpress"
  logoUrl: string | null   // Logo del tenant
  primaryColor: string     // Color primario hex
}
```

Estructura del documento:
- **Portada**: Logo del tenant, "{tenantName}", subtitulo "Terminos y Condiciones del Servicio de Logistica Flex"
- **Introduccion**: Parrafo legal que establece las partes (tenant como prestador, "El Vendedor" como cliente)
- **Seccion 1 - Tarifas y Facturacion**: Subsecciones 1.1 (Precios Netos) y 1.2 (Facturacion con IVA 21%)
- **Seccion 2 - Operatoria de Entregas**: Subsecciones 2.1 (2 intentos sin costo) y 2.2 (3er intento = tarifa completa)
- **Seccion 3 - Liquidaciones**: Subsecciones 3.1 (semanal), 3.2 (48hs habiles) y 3.3 (mora 5%)
- **Seccion 4 - Compromiso de Servicio**: Parrafo de cierre
- **Pie**: "{tenantName} -- Velocidad y confianza en cada entrega."

### Detalle de la Card en SystemSettings

- Icono: `Scale` de lucide-react (representando terminos legales)
- Titulo: "Terminos Flex"
- Descripcion: "Condiciones comerciales para vendedores Flex"
- Lista: Tarifas y facturacion, Intentos de entrega, Liquidaciones y pagos, Compromiso de servicio
- Botones: "Descargar" + "WhatsApp" (mismo patron que la Card de Guia Flex)
- El mensaje de WhatsApp dira: "Hola! Te comparto los Terminos y Condiciones del servicio Flex de {tenantName}. Por favor revisa el archivo adjunto."

No se requieren cambios en la base de datos.
