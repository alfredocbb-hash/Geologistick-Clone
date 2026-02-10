
# Documentacion de Homologacion Publica para Tiendanube

## Problema

Tiendanube solicita que la documentacion de homologacion sea accesible mediante un enlace publico (cualquier persona con el link pueda verla). Actualmente los documentos solo se generan como PDFs descargables desde una pagina protegida (IntegrationSettings), lo cual no permite compartir un link directo.

## Solucion

Crear una pagina publica `/docs/tiendanube` que renderice todo el contenido de los 3 documentos de homologacion directamente en el navegador, con diseño profesional y sin requerir autenticacion.

El enlace a compartir seria: **https://geologic.lovable.app/docs/tiendanube**

## Contenido de la pagina

La pagina mostrara en una sola vista con navegacion por tabs:

1. **Documento de Homologacion** - Informacion general, flujo OAuth, endpoints, webhooks, seguridad, GDPR, shipping carrier, ciclo de vida, URLs y contacto (10 secciones)
2. **Diagrama de Secuencia** - Los 6 flujos tecnicas con diagramas visuales (Instalacion, Nuevo Pedido, Cotizacion, Fulfillment, Desinstalacion, Reinstalacion)
3. **FAQs Tecnicas** - Preguntas frecuentes organizadas por categoria

## Seccion tecnica

### Archivos nuevos

**`src/pages/TiendanubeDocsPublic.tsx`**

Pagina React publica que:
- Importa los objetos de contenido (`HOMOLOGACION_CONTENT`, `FAQ_CONTENT`, y los datos de diagramas) desde los archivos existentes de generacion de PDF
- Renderiza el contenido en HTML con estilos Tailwind profesionales (colores azul Tiendanube `#2F5496`)
- Usa Tabs de shadcn para las 3 secciones
- Header con logo de Geologistick y titulo "Documentacion de Homologacion - Tiendanube"
- Cada seccion del documento se renderiza como Cards con titulos y contenido formateado
- Los diagramas de secuencia se muestran como bloques estilizados con formato actor-flecha-actor
- Totalmente responsive
- Sin requerir autenticacion

### Archivos modificados

**`src/lib/generateHomologacionPDF.ts`**
- Exportar `HOMOLOGACION_CONTENT` para que la pagina publica pueda importarlo

**`src/lib/generateDiagramaSecuenciaPDF.ts`**
- Exportar las constantes de contenido de los diagramas de secuencia

**`src/lib/generateFAQsHomologacionPDF.ts`**
- Exportar `FAQ_CONTENT` para que la pagina publica pueda importarlo

**`src/App.tsx`**
- Agregar ruta publica: `<Route path="/docs/tiendanube" element={<TiendanubeDocsPublic />} />`
- Importar el nuevo componente

### Detalle de la pagina

```text
+--------------------------------------------------+
|  [Logo] Geologistick                             |
|  Documentacion de Homologacion - Tiendanube      |
+--------------------------------------------------+
|  [ Homologacion ] [ Diagramas ] [ FAQs ]         |
+--------------------------------------------------+
|                                                  |
|  Card: 1. INFORMACION GENERAL                    |
|  ------------------------------------------------|
|  Nombre: Geologistick                            |
|  URL: https://geologistick.com                   |
|  ...                                             |
|                                                  |
|  Card: 2. FLUJO OAUTH 2.0                        |
|  ------------------------------------------------|
|  Paso 1: Inicio de la Instalacion...             |
|  ...                                             |
|                                                  |
|  (10 secciones en total)                         |
+--------------------------------------------------+
|  Geologistick - 2026                             |
+--------------------------------------------------+
```

La pagina usa los mismos datos que ya generan los PDFs, asegurando consistencia total entre la version descargable y la version web.
