import { jsPDF } from 'jspdf';
import {
  loadLogoAsBase64,
  addPageHeader,
  addPageFooter,
  drawCoverPage,
  drawSectionHeader
} from './pdfHelpers';

const PRIMARY_COLOR: [number, number, number] = [47, 84, 150]; // Azul Tiendanube #2F5496

const HOMOLOGACION_CONTENT = {
  title: 'Documento de Homologacion',
  subtitle: 'Integracion OAuth 2.0 - Tiendanube Argentina',
  sections: [
    {
      title: '1. INFORMACION GENERAL DE LA APLICACION',
      content: `Nombre de la Aplicacion
Geologistick

URL
https://geologistick.com

Tipo
Aplicacion gratuita de gestion logistica. No posee planes pagos ni suscripciones.

Pais
Argentina

Plataforma
Web (React + Vite), alojada en Lovable Cloud

Descripcion
Geologistick es un sistema integral de gestion logistica que permite a empresas de transporte y mensajeria administrar envios, rutas, sucursales, choferes y liquidaciones. La integracion con Tiendanube permite a los comercios conectar su tienda online para automatizar la recepcion de pedidos y el calculo de tarifas de envio en tiempo real.`
    },
    {
      title: '2. FLUJO OAUTH 2.0',
      content: `Descripcion General
La aplicacion implementa el flujo de autorizacion OAuth 2.0 estandar de Tiendanube para obtener acceso seguro a los datos de la tienda del comerciante.

Paso 1: Inicio de la Instalacion
El comerciante inicia la instalacion de Geologistick desde el panel de aplicaciones de Tiendanube o mediante un enlace de autorizacion proporcionado por el administrador logistico.

Paso 2: Redireccion a Tiendanube
El sistema redirige al comerciante a la URL de autorizacion de Tiendanube:
https://www.tiendanube.com/apps/{client_id}/authorize

Paso 3: Solicitud de Permisos
Tiendanube muestra al comerciante los permisos solicitados por la aplicacion. El comerciante debe aceptar para continuar.

Paso 4: Callback con Codigo de Autorizacion
Una vez aceptados los permisos, Tiendanube redirige al comerciante a la Redirect URI configurada:
{SUPABASE_URL}/functions/v1/tiendanube-oauth/callback
La redireccion incluye un parametro "code" (codigo de autorizacion temporal).

Paso 5: Intercambio del Codigo por Tokens
El backend de Geologistick realiza un POST a:
https://www.tiendanube.com/apps/authorize/token
Enviando el code, client_id y client_secret para obtener:
• access_token: para autenticar llamadas a la API
• refresh_token: para renovar el access_token cuando expire

Paso 6: Almacenamiento Seguro de Tokens
Los tokens se almacenan de forma segura en la base de datos junto con:
• token_expires_at: fecha de expiracion del access_token
• store_id: identificador de la tienda en Tiendanube
• store_url: URL de la tienda
Los tokens nunca se exponen al frontend.

Paso 7: Renovacion Automatica
Cuando el access_token se acerca a su fecha de expiracion, el sistema lo renueva automaticamente utilizando el refresh_token, garantizando operacion continua sin intervencion del comerciante.`
    },
    {
      title: '3. ENDPOINTS IMPLEMENTADOS',
      content: `La aplicacion implementa cinco funciones de backend (Edge Functions) para la integracion con Tiendanube:

tiendanube-oauth
Gestiona el flujo OAuth 2.0 completo. Maneja la redireccion inicial del comerciante y el callback con el codigo de autorizacion. Realiza el intercambio del codigo por tokens y los almacena de forma segura. Registra automaticamente los webhooks y el transportista (shipping carrier) en la tienda.

tiendanube-webhook
Receptor de webhooks de Tiendanube. Valida la autenticidad de cada webhook recibido mediante firma HMAC-SHA256 antes de procesarlo. Rechaza con error 401 cualquier solicitud con firma invalida. Procesa los eventos de pedidos y el evento de desinstalacion.

tiendanube-shipping-rates
Cotizacion de envios en tiempo real. Responde a las consultas de tarifa que Tiendanube realiza durante el checkout cuando un comprador ingresa su direccion de envio. Calcula el precio basandose en la tarifa asignada al seller y devuelve las opciones de envio disponibles (estandar, express, retiro en sucursal).

tiendanube-fulfill
Actualizacion de cumplimiento (fulfillment). Cuando un envio es marcado como despachado en Geologistick, esta funcion notifica a Tiendanube con el numero de seguimiento (tracking number) y la URL de rastreo para que el comerciante y el comprador puedan consultar el estado del envio.

tiendanube-sync
Sincronizacion manual de pedidos. Permite al operador logistico forzar una sincronizacion de pedidos de una tienda especifica, importando pedidos que pudieran no haberse recibido via webhook.`
    },
    {
      title: '4. WEBHOOKS REGISTRADOS',
      content: `La aplicacion se suscribe a los siguientes eventos de webhook de Tiendanube. Los webhooks se registran automaticamente al completar el flujo OAuth.

order/created
Se dispara cuando se crea un nuevo pedido en la tienda. La aplicacion importa los datos del pedido (comprador, direccion, productos, montos) y lo registra en la base de datos para su posterior gestion logistica.

order/paid
Se dispara cuando el pago de un pedido es confirmado. La aplicacion actualiza el estado de pago del pedido, habilitandolo para la creacion de un envio.

order/fulfilled
Se dispara cuando un pedido es marcado como despachado. La aplicacion actualiza el estado de fulfillment del pedido en sus registros internos.

order/cancelled
Se dispara cuando un pedido es cancelado. La aplicacion marca el pedido como cancelado en su base de datos.

app/uninstalled (OBLIGATORIO)
Se dispara cuando el comerciante desinstala la aplicacion de su tienda. La aplicacion realiza una limpieza completa de credenciales:
• Elimina el access_token
• Elimina el refresh_token
• Elimina el token_expires_at
• Elimina el webhook_secret
• Elimina el shipping_carrier_id
Los datos historicos de pedidos y envios se preservan para consulta posterior.`
    },
    {
      title: '5. SEGURIDAD',
      content: `Validacion HMAC-SHA256 de Webhooks
Todos los webhooks recibidos de Tiendanube son validados mediante firma HMAC-SHA256. El sistema verifica que el encabezado de firma coincida con el hash calculado usando el webhook_secret almacenado. Las solicitudes con firma invalida son rechazadas con codigo HTTP 401.

Almacenamiento Seguro de Tokens
Los tokens de acceso (access_token y refresh_token) se almacenan exclusivamente en la base de datos del servidor. Nunca se transmiten ni se exponen al navegador del usuario ni al frontend de la aplicacion.

Renovacion Automatica de Tokens
El sistema monitorea la fecha de expiracion (token_expires_at) del access_token. Cuando el token esta proximo a expirar, se renueva automaticamente mediante el refresh_token, evitando interrupciones en el servicio.

Limpieza de Credenciales al Desinstalar
Cuando se recibe el evento app/uninstalled, la aplicacion elimina inmediatamente todas las credenciales sensibles del seller:
• access_token
• refresh_token
• token_expires_at
• webhook_secret
• shipping_carrier_id
Esto garantiza que no queden credenciales activas de tiendas que han desinstalado la aplicacion.

Validacion de Entradas
Las funciones de backend implementan validacion estricta de formatos para todos los datos de entrada (UUIDs, emails, coordenadas) mediante utilidades compartidas, previniendo inyeccion de datos malformados.`
    },
    {
      title: '6. GDPR / PRIVACIDAD',
      content: `La aplicacion reconoce y responde correctamente a los tres eventos obligatorios de privacidad/GDPR requeridos por Tiendanube:

store/redact
Evento recibido cuando una tienda solicita la eliminacion de sus datos. La aplicacion responde con codigo HTTP 200 OK, confirmando la recepcion del evento.

customers/redact
Evento recibido cuando se solicita la eliminacion de datos de un cliente especifico. La aplicacion responde con codigo HTTP 200 OK, confirmando la recepcion del evento.

customers/data_request
Evento recibido cuando un cliente solicita una copia de sus datos personales. La aplicacion responde con codigo HTTP 200 OK, confirmando la recepcion del evento.

Estos eventos son procesados por la misma funcion de webhook (tiendanube-webhook) que maneja los eventos de pedidos, y son identificados y respondidos de forma apropiada.`
    },
    {
      title: '7. TRANSPORTISTA (SHIPPING CARRIER)',
      content: `Registro Automatico
Al completar el flujo OAuth y conectar una tienda, la aplicacion registra automaticamente un transportista (shipping carrier) en Tiendanube. El nombre del transportista se configura dinamicamente segun la marca de la empresa logistica (tenant).

URL de Callback para Cotizacion
El transportista registrado tiene configurada una URL de callback que Tiendanube invoca durante el checkout para obtener las tarifas de envio:
{SUPABASE_URL}/functions/v1/tiendanube-shipping-rates

Tipos de Envio Soportados
La aplicacion responde con hasta tres opciones de envio segun la configuracion del seller:

Envio Estandar
Calculado con la tarifa principal asignada al seller. Incluye dias de entrega estimados configurables.

Envio Express
Disponible si el seller tiene configurada una tarifa express. Incluye recargo adicional y dias de entrega reducidos.

Retiro en Sucursal
Lista todas las sucursales activas del tenant que tengan habilitado el retiro por clientes. Cada sucursal aparece como una opcion de retiro independiente con su direccion.`
    },
    {
      title: '8. CICLO DE VIDA DE LA APLICACION',
      content: `Instalacion
1. El comerciante inicia la instalacion desde Tiendanube
2. Se ejecuta el flujo OAuth 2.0 completo
3. Se obtienen y almacenan los tokens de acceso
4. Se registran automaticamente los webhooks para los eventos de pedidos
5. Se registra el transportista (shipping carrier) con la URL de cotizacion
6. La tienda queda conectada y operativa

Desinstalacion
Cuando el comerciante desinstala la aplicacion:
1. Tiendanube envia el webhook app/uninstalled
2. La aplicacion valida la firma del webhook
3. Se eliminan las credenciales sensibles:
   • access_token
   • refresh_token
   • token_expires_at
   • webhook_secret
   • shipping_carrier_id
4. Los datos historicos (pedidos, envios) se preservan
5. El seller queda registrado pero sin conexion activa

Reinstalacion
Si el comerciante reinstala la aplicacion:
1. Se ejecuta nuevamente el flujo OAuth 2.0
2. El sistema detecta que el seller ya existe en la base de datos
3. Se actualizan los tokens con los nuevos valores
4. Se re-registran los webhooks y el transportista
5. La tienda vuelve a estar operativa con su historial intacto`
    },
    {
      title: '9. URLs Y CONFIGURACION TECNICA',
      content: `URLs de Tiendanube

URL de Autorizacion
https://www.tiendanube.com/apps/{client_id}/authorize

URL de Token
https://www.tiendanube.com/apps/authorize/token

Base de la API
https://api.tiendanube.com/v1

URLs de la Aplicacion (Edge Functions)

Redirect URI (OAuth Callback)
{SUPABASE_URL}/functions/v1/tiendanube-oauth/callback

URL de Webhooks
{SUPABASE_URL}/functions/v1/tiendanube-webhook

URL de Cotizacion de Envios (Shipping Rates)
{SUPABASE_URL}/functions/v1/tiendanube-shipping-rates

Identificacion

User-Agent
Geologistick (alfredocbb@gmail.com)

Permisos Solicitados (Scopes)
La aplicacion solicita los permisos necesarios para:
• Leer y gestionar pedidos
• Registrar y administrar el transportista
• Gestionar el fulfillment de pedidos
• Recibir webhooks de eventos`
    },
    {
      title: '10. CONTACTO E INFORMACION DEL DESARROLLADOR',
      content: `Desarrollador
Geologistick

Sitio Web
https://geologistick.com

Email de Contacto
alfredocbb@gmail.com

Plataforma de Desarrollo
Lovable (lovable.dev)

Tipo de Aplicacion
Gratuita - Sin planes pagos ni suscripciones

Pais de Operacion
Argentina

Soporte Tecnico
Para consultas tecnicas relacionadas con la integracion, contactar a alfredocbb@gmail.com`
    }
  ]
};

export const generarHomologacionPDF = async (): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;

  // Load logo
  const logoBase64 = await loadLogoAsBase64();

  // Date for footer
  const generatedDate = new Date().toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const addFooter = () => {
    addPageFooter(doc, pageWidth, pageHeight, generatedDate);
  };

  const addHeader = () => {
    addPageHeader(doc, logoBase64, 'Homologación Tiendanube - Geologistick', pageWidth, margin);
  };

  const checkNewPage = (neededHeight: number, withHeader = true) => {
    if (yPosition + neededHeight > pageHeight - 30) {
      addFooter();
      doc.addPage();
      if (withHeader) {
        addHeader();
      }
      yPosition = withHeader ? 28 : margin;
      return true;
    }
    return false;
  };

  // ===== COVER PAGE =====
  drawCoverPage(
    doc,
    logoBase64,
    'GEOLOGISTICK',
    'Gestión Logística',
    'DOCUMENTO DE HOMOLOGACIÓN',
    'Integración OAuth 2.0 - Tiendanube Argentina',
    pageWidth,
    PRIMARY_COLOR
  );

  // ===== TABLE OF CONTENTS =====
  doc.addPage();
  addHeader();
  yPosition = 32;

  doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Indice de Contenidos', margin, yPosition);
  yPosition += 12;

  doc.setDrawColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, margin + 60, yPosition);
  yPosition += 10;

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  HOMOLOGACION_CONTENT.sections.forEach((section) => {
    checkNewPage(8);
    doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.circle(margin + 2, yPosition - 2, 1.5, 'F');
    doc.text(section.title, margin + 8, yPosition);
    yPosition += 8;
  });

  addFooter();

  // ===== CONTENT SECTIONS =====
  HOMOLOGACION_CONTENT.sections.forEach((section) => {
    doc.addPage();

    drawSectionHeader(doc, section.title, pageWidth, PRIMARY_COLOR);

    yPosition = 40;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const lines = section.content.split('\n');

    lines.forEach((line) => {
      if (line.trim() === '') {
        yPosition += 4;
        return;
      }

      const isSubHeader = !line.startsWith('•') &&
        !line.startsWith(' ') &&
        !line.startsWith('1.') &&
        !line.startsWith('2.') &&
        !line.startsWith('3.') &&
        !line.startsWith('4.') &&
        !line.startsWith('5.') &&
        !line.startsWith('6.') &&
        !line.startsWith('7.') &&
        !line.startsWith('8.') &&
        !line.startsWith('9.') &&
        line.length < 60;

      const isUrl = line.includes('https://') || line.includes('{SUPABASE_URL}');

      if (isSubHeader && !isUrl) {
        checkNewPage(14, false);
        yPosition += 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      } else if (isUrl) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
      }

      const wrappedLines = doc.splitTextToSize(line, contentWidth);

      wrappedLines.forEach((wrappedLine: string) => {
        checkNewPage(7, false);
        doc.text(wrappedLine, margin, yPosition);
        yPosition += 6;
      });

      if (isSubHeader && !isUrl) {
        yPosition += 2;
        doc.setTextColor(50, 50, 50);
      }
    });

    addFooter();
  });

  doc.save('homologacion-geologistick-tiendanube.pdf');
};
