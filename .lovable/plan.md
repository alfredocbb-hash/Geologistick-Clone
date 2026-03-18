

## Plan: Generar PDF de Acuerdo Comercial al asignar plan a un tenant

### Objetivo
Al asignar un plan personalizado a un tenant desde el panel de Super Admin, agregar un botón para descargar un PDF de "Acuerdo Comercial" que incluya los datos del plan, la empresa, y la cláusula de pago del 1 al 10 de cada mes.

### Cambios

**1. Nuevo archivo `src/lib/generateAcuerdoComercialPDF.ts`**
- Función `generateAcuerdoComercialPDF(params)` usando jsPDF + los helpers existentes de `pdfHelpers.ts`
- Parámetros: nombre del tenant, datos del plan (nombre, precio, límites, features), fecha de inicio del período
- Contenido del PDF:
  - Portada con logo y título "Acuerdo Comercial de Servicio"
  - Datos de la empresa (nombre del tenant)
  - Detalle del plan contratado (nombre, precio, límites, funcionalidades)
  - Cláusula de pago: "El pago del servicio deberá realizarse entre el 1 y el 10 de cada mes"
  - Condiciones generales (vigencia, cancelación)
  - Espacio para firma de ambas partes
  - Footer con fecha de generación

**2. Modificar `src/components/subscriptions/SuperAdminSubscriptionManager.tsx`**
- En la tabla de "Empresas y Planes", agregar un botón de descarga de PDF (ícono FileDown) junto a los botones existentes de cada tenant
- El botón solo aparece si el tenant tiene un plan activo asignado
- Al hacer click, genera y descarga el PDF con los datos del tenant y su plan actual

**3. Modificar `src/pages/SubscriptionPlansAdmin.tsx`**
- En el diálogo de crear/editar plan, agregar un botón "Descargar Acuerdo Comercial" (solo visible al editar un plan existente, como plantilla genérica sin nombre de empresa)

### Datos del PDF
- Nombre de la empresa (tenant)
- Plan contratado (nombre, descripción)
- Precio mensual
- Límites: usuarios, sucursales, envíos/mes
- Funcionalidades incluidas
- Condiciones de pago: "Del 1 al 10 de cada mes"
- Fecha de generación
- Espacios para firma

