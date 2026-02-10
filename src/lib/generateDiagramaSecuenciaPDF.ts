import { jsPDF } from 'jspdf';
import { loadLogoAsBase64, addPageHeader, addPageFooter, drawCoverPage, drawSectionHeader } from './pdfHelpers';

const PRIMARY_COLOR: [number, number, number] = [47, 84, 150]; // Azul Tiendanube #2F5496

export interface DiagramStep {
  from: string;
  to: string;
  description: string;
}

function drawDiagramSteps(doc: jsPDF, steps: DiagramStep[], startY: number, pageWidth: number, margin: number): number {
  let y = startY;
  const lineHeight = 7;
  const maxWidth = pageWidth - margin * 2;
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont('courier', 'normal');
  doc.setFontSize(9);

  for (const step of steps) {
    if (y > pageHeight - 30) {
      doc.addPage();
      y = 25;
    }

    const arrow = `${step.from} --> ${step.to}`;
    const fullLine = `${arrow} : ${step.description}`;

    // Draw actor names in bold color
    doc.setFont('courier', 'bold');
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.text(step.from, margin, y);

    const fromWidth = doc.getTextWidth(step.from);
    doc.setFont('courier', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(' --> ', margin + fromWidth, y);

    const arrowWidth = doc.getTextWidth(' --> ');
    doc.setFont('courier', 'bold');
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.text(step.to, margin + fromWidth + arrowWidth, y);

    y += lineHeight;

    // Description indented
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    const descLines = doc.splitTextToSize(`  → ${step.description}`, maxWidth - 10);
    doc.text(descLines, margin + 5, y);
    y += descLines.length * lineHeight;

    // Separator line
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, y - 2, pageWidth - margin, y - 2);
    y += 3;

    doc.setFontSize(9);
  }

  return y;
}

function drawNote(doc: jsPDF, text: string, y: number, pageWidth: number, margin: number): number {
  doc.setFillColor(255, 250, 230);
  doc.setDrawColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.setLineWidth(0.5);
  const noteWidth = pageWidth - margin * 2;
  doc.roundedRect(margin, y, noteWidth, 14, 2, 2, 'FD');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(80, 80, 80);
  doc.text(`📌 ${text}`, margin + 5, y + 9);
  return y + 20;
}

function addSectionTitle(doc: jsPDF, title: string, y: number, margin: number): number {
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.text(title, margin, y);
  y += 3;
  doc.setDrawColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin + doc.getTextWidth(title), y);
  return y + 10;
}

export async function generarDiagramaSecuenciaPDF() {
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
    'DIAGRAMA DE SECUENCIA',
    'Integracion OAuth 2.0 - Tiendanube Argentina',
    pageWidth, PRIMARY_COLOR
  );

  // === PAGINA 2: ACTORES DEL SISTEMA ===
  doc.addPage();
  addPageHeader(doc, logoBase64, 'Diagrama de Secuencia - Geologistick x Tiendanube', pageWidth, margin);
  let y = 30;

  y = addSectionTitle(doc, '1. Actores del Sistema', y, margin);

  const actors = [
    { name: 'Merchant', desc: 'Comerciante con tienda en Tiendanube que instala la aplicacion de envios.' },
    { name: 'Tiendanube', desc: 'Plataforma de e-commerce que gestiona la autorizacion OAuth 2.0 y eventos.' },
    { name: 'Geologistick Backend', desc: 'Edge Functions que procesan OAuth, webhooks, cotizaciones y fulfillment.' },
    { name: 'Base de Datos', desc: 'Almacenamiento seguro de tokens, credenciales y datos de pedidos/envios.' },
  ];

  for (const actor of actors) {
    doc.setFillColor(240, 244, 255);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 16, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.text(actor.name, margin + 5, y + 7);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(actor.desc, margin + 5, y + 13);
    y += 22;
  }

  addPageFooter(doc, pageWidth, pageHeight, generatedDate);

  // === PAGINA 3: FLUJO OAUTH ===
  doc.addPage();
  drawSectionHeader(doc, '2. Flujo de Instalacion y Autorizacion OAuth', pageWidth, PRIMARY_COLOR);
  y = 38;

  const oauthSteps: DiagramStep[] = [
    { from: 'Merchant', to: 'Tiendanube', description: 'Instala Geologistick desde el panel de apps' },
    { from: 'Tiendanube', to: 'Merchant', description: 'Muestra permisos solicitados (pedidos, fulfillment, webhooks, shipping)' },
    { from: 'Merchant', to: 'Tiendanube', description: 'Acepta permisos de la aplicacion' },
    { from: 'Tiendanube', to: 'Geologistick', description: 'Redirige a /callback con authorization code' },
    { from: 'Geologistick', to: 'Tiendanube', description: 'POST /apps/authorize/token (code + client_id + client_secret)' },
    { from: 'Tiendanube', to: 'Geologistick', description: 'Retorna access_token + refresh_token + token_expires_at' },
    { from: 'Geologistick', to: 'Base de Datos', description: 'Almacena tokens de forma segura + token_expires_at' },
    { from: 'Geologistick', to: 'Tiendanube', description: 'Registra webhooks (order/created, order/paid, order/fulfilled, order/cancelled, app/uninstalled)' },
    { from: 'Geologistick', to: 'Tiendanube', description: 'Registra shipping carrier con URL de cotizacion en tiempo real' },
    { from: 'Geologistick', to: 'Merchant', description: 'Redirige a pagina de conexion exitosa en Geologistick' },
  ];

  y = drawDiagramSteps(doc, oauthSteps, y, pageWidth, margin);
  addPageFooter(doc, pageWidth, pageHeight, generatedDate);

  // === PAGINA 4: FLUJO DE USO NORMAL ===
  doc.addPage();
  drawSectionHeader(doc, '3. Flujo de Uso Normal', pageWidth, PRIMARY_COLOR);
  y = 38;

  // 3a: Webhooks
  y = addSectionTitle(doc, '3a. Recepcion de Pedidos via Webhook', y, margin);
  const webhookSteps: DiagramStep[] = [
    { from: 'Tiendanube', to: 'Geologistick', description: 'Envia webhook con evento (ej: order/created) firmado HMAC-SHA256' },
    { from: 'Geologistick', to: 'Geologistick', description: 'Valida firma HMAC-SHA256 con webhook_secret del seller' },
    { from: 'Geologistick', to: 'Tiendanube', description: 'GET /orders/{id} para obtener datos completos del pedido' },
    { from: 'Geologistick', to: 'Base de Datos', description: 'Almacena pedido en ecommerce_orders con datos del comprador y envio' },
    { from: 'Geologistick', to: 'Tiendanube', description: 'Responde HTTP 200 OK confirmando recepcion' },
  ];
  y = drawDiagramSteps(doc, webhookSteps, y, pageWidth, margin);

  // 3b: Cotizacion
  y = addSectionTitle(doc, '3b. Cotizacion de Envios en Checkout', y, margin);
  const cotizacionSteps: DiagramStep[] = [
    { from: 'Tiendanube', to: 'Geologistick', description: 'POST /tiendanube-shipping-rates con destino y dimensiones del paquete' },
    { from: 'Geologistick', to: 'Base de Datos', description: 'Consulta tarifa asignada al seller (tarifa_id y tarifa_express_id)' },
    { from: 'Geologistick', to: 'Geologistick', description: 'Calcula opciones: Estandar, Express y Retiro en sucursal' },
    { from: 'Geologistick', to: 'Tiendanube', description: 'Retorna array de rates con precio, plazo y nombre del servicio' },
  ];
  y = drawDiagramSteps(doc, cotizacionSteps, y, pageWidth, margin);

  addPageFooter(doc, pageWidth, pageHeight, generatedDate);

  // 3c: Fulfillment
  doc.addPage();
  addPageHeader(doc, logoBase64, 'Diagrama de Secuencia - Geologistick x Tiendanube', pageWidth, margin);
  y = 30;

  y = addSectionTitle(doc, '3c. Actualizacion de Fulfillment con Tracking', y, margin);
  const fulfillmentSteps: DiagramStep[] = [
    { from: 'Geologistick', to: 'Base de Datos', description: 'Detecta envio entregado (estado = entregado) vinculado a pedido Tiendanube' },
    { from: 'Geologistick', to: 'Tiendanube', description: 'POST /orders/{id}/fulfill con tracking_number y shipping_company' },
    { from: 'Tiendanube', to: 'Geologistick', description: 'Confirma fulfillment exitoso (HTTP 200)' },
    { from: 'Tiendanube', to: 'Merchant', description: 'Notifica al comerciante que el pedido fue despachado' },
  ];
  y = drawDiagramSteps(doc, fulfillmentSteps, y, pageWidth, margin);

  // 3d: Token refresh
  y = addSectionTitle(doc, '3d. Renovacion Automatica de Tokens', y, margin);
  const tokenSteps: DiagramStep[] = [
    { from: 'Geologistick', to: 'Base de Datos', description: 'Detecta token_expires_at proximo a expirar' },
    { from: 'Geologistick', to: 'Tiendanube', description: 'POST /apps/authorize/token con refresh_token + client_id + client_secret' },
    { from: 'Tiendanube', to: 'Geologistick', description: 'Retorna nuevo access_token + refresh_token + token_expires_at' },
    { from: 'Geologistick', to: 'Base de Datos', description: 'Actualiza tokens con los nuevos valores de forma segura' },
  ];
  y = drawDiagramSteps(doc, tokenSteps, y, pageWidth, margin);

  addPageFooter(doc, pageWidth, pageHeight, generatedDate);

  // === PAGINA 5: DESINSTALACION ===
  doc.addPage();
  drawSectionHeader(doc, '4. Flujo de Desinstalacion', pageWidth, PRIMARY_COLOR);
  y = 38;

  const uninstallSteps: DiagramStep[] = [
    { from: 'Merchant', to: 'Tiendanube', description: 'Desinstala la aplicacion Geologistick desde el panel de apps' },
    { from: 'Tiendanube', to: 'Geologistick', description: 'Envia webhook app/uninstalled firmado con HMAC-SHA256' },
    { from: 'Geologistick', to: 'Geologistick', description: 'Valida firma HMAC-SHA256 del webhook recibido' },
    { from: 'Geologistick', to: 'Base de Datos', description: 'Elimina access_token del seller' },
    { from: 'Geologistick', to: 'Base de Datos', description: 'Elimina refresh_token del seller' },
    { from: 'Geologistick', to: 'Base de Datos', description: 'Elimina token_expires_at del seller' },
    { from: 'Geologistick', to: 'Base de Datos', description: 'Elimina webhook_secret del seller' },
    { from: 'Geologistick', to: 'Base de Datos', description: 'Elimina shipping_carrier_id del seller' },
  ];
  y = drawDiagramSteps(doc, uninstallSteps, y, pageWidth, margin);
  y = drawNote(doc, 'Los datos historicos (pedidos, envios, liquidaciones) se PRESERVAN intactos.', y, pageWidth, margin);

  addPageFooter(doc, pageWidth, pageHeight, generatedDate);

  // === PAGINA 6: REINSTALACION ===
  doc.addPage();
  drawSectionHeader(doc, '5. Flujo de Reinstalacion', pageWidth, PRIMARY_COLOR);
  y = 38;

  const reinstallSteps: DiagramStep[] = [
    { from: 'Merchant', to: 'Tiendanube', description: 'Reinstala la aplicacion Geologistick desde el panel de apps' },
    { from: 'Tiendanube', to: 'Merchant', description: 'Muestra permisos solicitados nuevamente' },
    { from: 'Merchant', to: 'Tiendanube', description: 'Acepta permisos de la aplicacion' },
    { from: 'Tiendanube', to: 'Geologistick', description: 'Redirige a /callback con nuevo authorization code' },
    { from: 'Geologistick', to: 'Tiendanube', description: 'POST /apps/authorize/token (intercambio de code por tokens)' },
    { from: 'Tiendanube', to: 'Geologistick', description: 'Retorna nuevos access_token + refresh_token' },
    { from: 'Geologistick', to: 'Base de Datos', description: 'Detecta seller existente por store_id' },
    { from: 'Geologistick', to: 'Base de Datos', description: 'Actualiza tokens con nuevos valores (no crea registro duplicado)' },
    { from: 'Geologistick', to: 'Tiendanube', description: 'Re-registra webhooks y shipping carrier' },
    { from: 'Geologistick', to: 'Merchant', description: 'Redirige a pagina de conexion exitosa' },
  ];
  y = drawDiagramSteps(doc, reinstallSteps, y, pageWidth, margin);
  y = drawNote(doc, 'Resultado: Tienda operativa con todo el historial intacto y nuevas credenciales.', y, pageWidth, margin);

  addPageFooter(doc, pageWidth, pageHeight, generatedDate);

  // Save
  doc.save('diagrama-secuencia-geologistick-tiendanube.pdf');
}
