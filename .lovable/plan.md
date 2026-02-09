

# Documentos Complementarios de Homologacion - Tiendanube

## Objetivo

Generar dos PDFs adicionales para completar la checklist de homologacion (sin el video):

1. **Diagrama de Secuencia** - PDF profesional con el diagrama de flujo de la integracion
2. **FAQs Tecnicas** - PDF con preguntas frecuentes sobre la integracion

Ambos documentos deben ser coherentes con el PDF de homologacion ya existente.

---

## Archivo 1: `src/lib/generateDiagramaSecuenciaPDF.ts`

PDF dedicado al diagrama de secuencia con los 5 flujos requeridos, representados en formato texto con actores y flechas ASCII.

### Estructura del documento

**Portada**
- Logo Geologistick
- Titulo: "DIAGRAMA DE SECUENCIA"
- Subtitulo: "Integracion OAuth 2.0 - Tiendanube Argentina"
- Color primario: Azul Tiendanube (#2F5496)

**Seccion 1: Actores del Sistema**
- Merchant (Comerciante con tienda en Tiendanube)
- Tiendanube (Plataforma de e-commerce)
- Geologistick Backend (Edge Functions)
- Base de Datos (Almacenamiento seguro)

**Seccion 2: Flujo de Instalacion y Autorizacion OAuth**
Diagrama paso a paso con flechas descriptivas:

```text
Merchant --> Tiendanube : Instala Geologistick desde el panel de apps
Tiendanube --> Merchant : Muestra permisos solicitados
Merchant --> Tiendanube : Acepta permisos
Tiendanube --> Geologistick : Redirige a /callback con code
Geologistick --> Tiendanube : POST /apps/authorize/token (code + client_id + client_secret)
Tiendanube --> Geologistick : Retorna access_token + refresh_token
Geologistick --> Base de Datos : Almacena tokens + token_expires_at
Geologistick --> Tiendanube : Registra webhooks (order/created, order/paid, etc.)
Geologistick --> Tiendanube : Registra shipping carrier con URL de cotizacion
Geologistick --> Merchant : Muestra pagina de conexion exitosa
```

**Seccion 3: Flujo de Uso Normal**
Sub-diagramas para:
- Recepcion de pedidos via webhook (con validacion HMAC-SHA256)
- Cotizacion de envios durante checkout
- Actualizacion de fulfillment con tracking
- Renovacion automatica de tokens expirados

**Seccion 4: Flujo de Desinstalacion**

```text
Merchant --> Tiendanube : Desinstala la aplicacion
Tiendanube --> Geologistick : Webhook app/uninstalled (firmado HMAC-SHA256)
Geologistick --> Geologistick : Valida firma del webhook
Geologistick --> Base de Datos : Elimina access_token
Geologistick --> Base de Datos : Elimina refresh_token
Geologistick --> Base de Datos : Elimina token_expires_at
Geologistick --> Base de Datos : Elimina webhook_secret
Geologistick --> Base de Datos : Elimina shipping_carrier_id
Nota: Los datos historicos (pedidos, envios) se PRESERVAN
```

**Seccion 5: Flujo de Reinstalacion**

```text
Merchant --> Tiendanube : Reinstala la aplicacion
(Se repite flujo OAuth completo)
Geologistick --> Base de Datos : Detecta seller existente
Geologistick --> Base de Datos : Actualiza tokens con nuevos valores
Geologistick --> Tiendanube : Re-registra webhooks y carrier
Resultado: Tienda operativa con historial intacto
```

### Implementacion tecnica
- Usa `jsPDF` y helpers de `pdfHelpers.ts`
- Cada flujo en su propia pagina con header de color
- Flechas representadas con formato monoespaciado (courier) para alineacion
- Exporta funcion: `generarDiagramaSecuenciaPDF()`
- Nombre del archivo: `diagrama-secuencia-geologistick-tiendanube.pdf`

---

## Archivo 2: `src/lib/generateFAQsHomologacionPDF.ts`

PDF con preguntas frecuentes tecnicas orientadas al proceso de homologacion.

### Estructura del documento

**Portada**
- Logo Geologistick
- Titulo: "PREGUNTAS FRECUENTES"
- Subtitulo: "Integracion OAuth 2.0 - Tiendanube Argentina"

**Contenido (FAQs agrupadas por categoria)**

Categoria: Informacion General
- Que es Geologistick? - Sistema integral de gestion logistica para empresas de transporte
- La aplicacion tiene costo? - No, es completamente gratuita sin planes pagos
- En que pais opera? - Argentina
- Donde esta alojada? - Web (React + Vite) en Lovable Cloud

Categoria: Integracion OAuth
- Como se instala la app en una tienda? - El comerciante autoriza desde el panel de Tiendanube
- Que permisos solicita? - Lectura/gestion de pedidos, registro de transportista, fulfillment, webhooks
- Donde se almacenan los tokens? - Exclusivamente en la base de datos del servidor, nunca en el frontend
- Se renuevan automaticamente los tokens? - Si, mediante refresh_token antes de la expiracion

Categoria: Webhooks y Seguridad
- Como se validan los webhooks? - Mediante firma HMAC-SHA256 con el webhook_secret
- Que eventos procesa la app? - order/created, order/paid, order/fulfilled, order/cancelled, app/uninstalled
- Que pasa si la firma es invalida? - Se rechaza con HTTP 401

Categoria: Desinstalacion y Datos
- Que ocurre al desinstalar la app? - Se eliminan todas las credenciales sensibles
- Se pierden los datos historicos? - No, pedidos y envios se preservan
- Se puede reinstalar? - Si, el flujo OAuth se ejecuta nuevamente y actualiza los tokens existentes

Categoria: GDPR / Privacidad
- Que eventos de privacidad maneja? - store/redact, customers/redact, customers/data_request
- Como responde a estos eventos? - Con HTTP 200 OK confirmando la recepcion

Categoria: Transportista y Envios
- Se registra automaticamente el carrier? - Si, al completar el flujo OAuth
- Que tipos de envio soporta? - Estandar, Express y Retiro en sucursal
- Como se calculan las tarifas? - En tiempo real durante el checkout, basado en la tarifa asignada al seller

### Implementacion tecnica
- Usa `jsPDF` y helpers de `pdfHelpers.ts`
- Formato: pregunta en negrita + respuesta en texto normal
- Agrupadas por categoria con separadores visuales
- Exporta funcion: `generarFAQsHomologacionPDF()`
- Nombre del archivo: `faqs-geologistick-tiendanube.pdf`

---

## Modificacion: `src/pages/IntegrationSettings.tsx`

Agregar dos botones adicionales en la seccion de Tiendanube, junto al boton existente de "Descargar Documento de Homologacion":

1. **"Descargar Diagrama de Secuencia"** - Llama a `generarDiagramaSecuenciaPDF()`
2. **"Descargar FAQs Tecnicas"** - Llama a `generarFAQsHomologacionPDF()`

Ambos botones con:
- Icono `FileText`
- Estado de carga individual
- Toast de confirmacion/error

Los tres botones se mostraran en un grid para mantener el layout ordenado.

---

## Sin dependencias nuevas

Todo se implementa con `jsPDF` (ya instalado) y los helpers existentes en `pdfHelpers.ts`.

