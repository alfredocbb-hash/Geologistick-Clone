import { jsPDF } from 'jspdf';
import { loadLogoAsBase64, addPageHeader, addPageFooter, drawCoverPage } from './pdfHelpers';

const PRIMARY_COLOR: [number, number, number] = [47, 84, 150]; // Azul Tiendanube #2F5496

interface FAQ {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  faqs: FAQ[];
}

const FAQ_CONTENT: FAQCategory[] = [
  {
    title: 'Informacion General',
    faqs: [
      { question: 'Que es Geologistick?', answer: 'Geologistick es un sistema integral de gestion logistica diseñado para empresas de transporte y mensajeria. Permite gestionar envios, rutas, choferes, sucursales, liquidaciones y mas, con integraciones de e-commerce para sincronizar pedidos automaticamente.' },
      { question: 'La aplicacion tiene costo para el comerciante?', answer: 'No. La aplicacion de Geologistick para Tiendanube es completamente gratuita. No existen planes pagos ni cargos adicionales por su uso. El servicio de envio se cobra segun las tarifas configuradas por la empresa de transporte.' },
      { question: 'En que pais opera Geologistick?', answer: 'Geologistick opera exclusivamente en Argentina. Todas las tarifas, cotizaciones y configuraciones estan orientadas al mercado argentino.' },
      { question: 'Donde esta alojada la aplicacion?', answer: 'La aplicacion web esta desarrollada con React + Vite + TypeScript y alojada en Lovable Cloud. El backend utiliza Edge Functions serverless y una base de datos PostgreSQL segura.' },
    ],
  },
  {
    title: 'Integracion OAuth 2.0',
    faqs: [
      { question: 'Como se instala la app en una tienda Tiendanube?', answer: 'El comerciante accede al marketplace de Tiendanube, busca Geologistick y hace clic en "Instalar". Tiendanube muestra los permisos solicitados y, al aceptarlos, redirige al callback de Geologistick donde se completa el flujo OAuth 2.0 automaticamente.' },
      { question: 'Que permisos solicita la aplicacion?', answer: 'La aplicacion solicita permisos para: lectura y gestion de pedidos (orders), registro de transportista (shipping carrier), fulfillment de pedidos, y registro de webhooks para recibir eventos en tiempo real.' },
      { question: 'Donde se almacenan los tokens de acceso?', answer: 'Los tokens (access_token, refresh_token y token_expires_at) se almacenan exclusivamente en la base de datos del servidor (tabla ecommerce_sellers). Nunca se exponen al frontend ni se almacenan en el navegador del usuario.' },
      { question: 'Se renuevan automaticamente los tokens?', answer: 'Si. El sistema verifica el campo token_expires_at antes de cada operacion. Si el token esta proximo a expirar, se utiliza el refresh_token para obtener nuevas credenciales automaticamente mediante POST /apps/authorize/token.' },
    ],
  },
  {
    title: 'Webhooks y Seguridad',
    faqs: [
      { question: 'Como se validan los webhooks recibidos?', answer: 'Cada webhook recibido se valida mediante firma HMAC-SHA256. El sistema calcula el hash del cuerpo del webhook usando el webhook_secret almacenado para cada seller y lo compara con la firma enviada en los headers por Tiendanube.' },
      { question: 'Que eventos de webhook procesa la aplicacion?', answer: 'La aplicacion procesa los siguientes eventos: order/created (nuevo pedido), order/paid (pedido pagado), order/fulfilled (pedido despachado), order/cancelled (pedido cancelado) y app/uninstalled (desinstalacion de la aplicacion).' },
      { question: 'Que ocurre si la firma del webhook es invalida?', answer: 'Si la firma HMAC-SHA256 no coincide con la esperada, el webhook se rechaza inmediatamente con un codigo HTTP 401 (Unauthorized). No se procesa ninguna accion con datos no verificados.' },
      { question: 'Se registra el webhook_secret de cada tienda?', answer: 'Si. Al completar el flujo OAuth, Geologistick registra los webhooks en Tiendanube y almacena el webhook_secret retornado en la base de datos, asociado al seller correspondiente.' },
    ],
  },
  {
    title: 'Desinstalacion y Datos',
    faqs: [
      { question: 'Que ocurre al desinstalar la aplicacion de una tienda?', answer: 'Al recibir el webhook app/uninstalled, el sistema elimina de forma segura todas las credenciales sensibles: access_token, refresh_token, token_expires_at, webhook_secret y shipping_carrier_id. La tienda queda desvinculada pero los datos historicos se preservan.' },
      { question: 'Se pierden los datos historicos al desinstalar?', answer: 'No. Los pedidos sincronizados (ecommerce_orders), los envios generados y las liquidaciones realizadas se preservan intactos en la base de datos. Solo se eliminan las credenciales de autenticacion.' },
      { question: 'Se puede reinstalar la aplicacion despues de desinstalarla?', answer: 'Si. Al reinstalar, se ejecuta el flujo OAuth 2.0 completo nuevamente. El sistema detecta el seller existente por su store_id y actualiza los tokens con los nuevos valores, sin crear registros duplicados. La tienda vuelve a estar operativa con todo su historial.' },
    ],
  },
  {
    title: 'GDPR / Privacidad',
    faqs: [
      { question: 'Que eventos de privacidad maneja la aplicacion?', answer: 'La aplicacion reconoce y procesa tres eventos de privacidad definidos por Tiendanube: store/redact (solicitud de eliminacion de datos de tienda), customers/redact (solicitud de eliminacion de datos de cliente) y customers/data_request (solicitud de exportacion de datos de cliente).' },
      { question: 'Como responde la aplicacion a estos eventos?', answer: 'Ante cada evento de privacidad, la aplicacion responde con HTTP 200 OK confirmando la recepcion del evento. El procesamiento se realiza segun las politicas de retencion de datos configuradas.' },
    ],
  },
  {
    title: 'Transportista y Envios',
    faqs: [
      { question: 'Se registra automaticamente el carrier al conectar una tienda?', answer: 'Si. Al completar el flujo OAuth exitosamente, el sistema registra automaticamente un shipping carrier en Tiendanube con la URL de cotizacion. El nombre del carrier se toma del branding configurado en la empresa (nombre_app).' },
      { question: 'Que tipos de envio soporta la integracion?', answer: 'La integracion soporta tres tipos de envio: Estandar (basado en tarifa_id del seller), Express (con tarifa_express_id y recargo configurables) y Retiro en sucursal (pickup points en sucursales activas que permiten retiro de clientes).' },
      { question: 'Como se calculan las tarifas de envio?', answer: 'Las tarifas se calculan en tiempo real durante el checkout del comprador. Tiendanube envia los datos del destino y paquete al endpoint de cotizacion, y Geologistick calcula los precios basandose en las tarifas asignadas al seller, considerando peso, dimensiones y zona de cobertura.' },
    ],
  },
];

export async function generarFAQsHomologacionPDF() {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const generatedDate = new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });

  const logoBase64 = await loadLogoAsBase64();

  // === PORTADA ===
  drawCoverPage(
    doc, logoBase64,
    'GEOLOGISTICK',
    'Sistema de Gestion Logistica',
    'PREGUNTAS FRECUENTES',
    'Integracion OAuth 2.0 - Tiendanube Argentina',
    pageWidth, PRIMARY_COLOR
  );

  // === INDICE ===
  doc.addPage();
  addPageHeader(doc, logoBase64, 'FAQs - Geologistick x Tiendanube', pageWidth, margin);
  let y = 32;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.text('Indice de Contenidos', margin, y);
  y += 12;

  FAQ_CONTENT.forEach((category, idx) => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(`${idx + 1}. ${category.title}`, margin + 5, y);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`(${category.faqs.length} preguntas)`, margin + 100, y);
    y += 8;
  });

  addPageFooter(doc, pageWidth, pageHeight, generatedDate);

  // === CONTENIDO ===
  for (let catIdx = 0; catIdx < FAQ_CONTENT.length; catIdx++) {
    const category = FAQ_CONTENT[catIdx];
    doc.addPage();
    addPageHeader(doc, logoBase64, 'FAQs - Geologistick x Tiendanube', pageWidth, margin);
    y = 32;

    // Category header
    doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.roundedRect(margin, y - 5, pageWidth - margin * 2, 12, 2, 2, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`${catIdx + 1}. ${category.title}`, margin + 5, y + 3);
    y += 16;

    for (let faqIdx = 0; faqIdx < category.faqs.length; faqIdx++) {
      const faq = category.faqs[faqIdx];

      // Check page break
      if (y > pageHeight - 50) {
        addPageFooter(doc, pageWidth, pageHeight, generatedDate);
        doc.addPage();
        addPageHeader(doc, logoBase64, 'FAQs - Geologistick x Tiendanube', pageWidth, margin);
        y = 32;
      }

      // Question number badge
      doc.setFillColor(240, 244, 255);
      doc.roundedRect(margin, y - 4, pageWidth - margin * 2, 10, 1.5, 1.5, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.text(`P${faqIdx + 1}: ${faq.question}`, margin + 4, y + 3);
      y += 12;

      // Answer
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const answerLines = doc.splitTextToSize(faq.answer, pageWidth - margin * 2 - 10);
      
      // Check if answer fits
      if (y + answerLines.length * 5 > pageHeight - 25) {
        addPageFooter(doc, pageWidth, pageHeight, generatedDate);
        doc.addPage();
        addPageHeader(doc, logoBase64, 'FAQs - Geologistick x Tiendanube', pageWidth, margin);
        y = 32;
      }
      
      doc.text(answerLines, margin + 4, y);
      y += answerLines.length * 5 + 8;

      // Separator
      if (faqIdx < category.faqs.length - 1) {
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.line(margin + 10, y - 4, pageWidth - margin - 10, y - 4);
      }
    }

    addPageFooter(doc, pageWidth, pageHeight, generatedDate);
  }

  // Save
  doc.save('faqs-geologistick-tiendanube.pdf');
}
