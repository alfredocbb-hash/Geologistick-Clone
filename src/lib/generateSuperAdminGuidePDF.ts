import { jsPDF } from 'jspdf';
import {
  loadLogoAsBase64,
  addPageHeader,
  addPageFooter,
  drawCoverPage,
  drawSectionHeader
} from './pdfHelpers';

const GUIDE_CONTENT = {
  title: 'Guía de Super Administrador - Geologistick',
  subtitle: 'Panel de Control del Sistema',
  sections: [
    {
      title: '1. GESTIÓN DE TENANTS (EMPRESAS)',
      content: `Acceso: Menú lateral > Tenants

Crear Empresa
1. Clic en "Nuevo Tenant"
2. Completar: nombre, slug (identificador único), plan
3. Configurar límites: usuarios, sucursales, envíos/mes
4. La empresa se crea activa por defecto

Editar Empresa
• Modificar nombre, slug, plan y límites
• Activar o desactivar una empresa
• Al desactivar, los usuarios de esa empresa no pueden acceder

Detalle de Empresa
• Ver información completa del tenant
• Ver cantidad de usuarios, sucursales y envíos
• Acceder a API Keys, branding y suscripción

Consideraciones
• Cada empresa opera con datos completamente aislados
• El slug debe ser único en todo el sistema
• Los límites se validan automáticamente al crear envíos/usuarios`
    },
    {
      title: '2. GESTIÓN DE USUARIOS',
      content: `Acceso: Menú lateral > Usuarios

Crear Usuario
1. Clic en "Nuevo Usuario"
2. Ingresar email, nombre y contraseña temporal
3. Seleccionar el tenant al que pertenecerá
4. Asignar rol: admin, operador, chofer, supervisor
5. Asignar sucursal (opcional)

Roles Disponibles
• super_admin: Acceso total al sistema (solo para gestión central)
• admin: Administrador de un tenant específico
• supervisor: Supervisión de operaciones
• operador: Operaciones de sucursal (escaneo, recepción)
• chofer: Conductor de rutas y entregas

Resetear Contraseña
1. Seleccionar usuario
2. Clic en "Resetear Contraseña"
3. Se envía un email con enlace de recuperación

Desactivar Usuario
• Los usuarios desactivados no pueden iniciar sesión
• Sus datos y asignaciones se mantienen para historial`
    },
    {
      title: '3. BRANDING POR TENANT',
      content: `Acceso: Tenants > Detalle > Branding

Configuración Visual
• Nombre de la App: El nombre que ven los usuarios del tenant
• Logo Claro: Logo para fondos claros (header, PDF)
• Logo Oscuro: Logo para modo oscuro
• Color Primario: Color principal de la interfaz (formato HEX)

Aplicación del Branding
• El logo aparece en el header de la aplicación
• Los PDFs generados (etiquetas, guías, liquidaciones) usan el logo
• El color primario se aplica a botones y acentos
• El tracking público muestra el branding del tenant

Dominio Personalizado
• Cada tenant puede tener su propio slug en la URL
• El widget de tracking embebible usa el branding del tenant`
    },
    {
      title: '4. PERMISOS POR ROL',
      content: `Acceso: Menú lateral > Permisos por Rol

Sistema de Permisos
El sistema usa permisos granulares que se asignan por rol y por tenant.

Categorías de Permisos
• Envíos: crear, editar, eliminar, cambiar estado
• Sucursales: ver, crear, editar
• Rutas: crear, asignar, iniciar
• Finanzas: ver liquidaciones, cobrar, rendir
• Usuarios: crear, editar, desactivar
• Configuración: acceder a ajustes del sistema

Configurar Permisos
1. Seleccionar rol a configurar
2. Marcar/desmarcar permisos individuales
3. Guardar cambios
4. Los cambios aplican inmediatamente a todos los usuarios con ese rol

Recomendaciones
• No otorgar permisos de finanzas a roles operativos
• Los choferes solo necesitan permisos de rutas y escaneo
• Los supervisores deben poder ver reportes sin modificar datos`
    },
    {
      title: '5. API KEYS',
      content: `Acceso: Tenants > Detalle > API Keys

Qué son las API Keys
Claves de autenticación para integrar sistemas externos con Geologistick.
Cada tenant puede tener múltiples API Keys activas.

Generar API Key
1. Ir al detalle del tenant
2. Clic en "API Keys"
3. Clic en "Generar Nueva Key"
4. IMPORTANTE: Copiar la key inmediatamente (no se muestra de nuevo)
5. Se almacena un hash seguro (HMAC-SHA256)

Seguridad
• Las keys se hashean con HMAC antes de almacenarse
• Solo se muestra el prefijo (tk_XXXX...YYYY) después de la creación
• Se registra la última fecha de uso
• Se pueden revocar en cualquier momento

Uso de API Keys
Las integraciones envían la API Key en el header Authorization.
El sistema valida el hash y asocia la request al tenant correcto.`
    },
    {
      title: '6. PLANES Y SUSCRIPCIONES',
      content: `Acceso: Menú lateral > Planes de Suscripción

Planes Disponibles
• Trial: 14 días gratis con límites básicos (5 usuarios, 3 sucursales, 500 envíos/mes)
• Planes pagos: Configurables con límites personalizados

Gestión de Planes
1. Crear planes con nombre, precio y límites
2. Asignar Stripe Product ID y Price ID para cobro automático
3. Activar/desactivar planes

Suscripciones de Tenants
• Cada tenant tiene una suscripción activa
• Se controla automáticamente via Mercado Pago o Stripe
• Al vencer el trial, se restringe la creación de envíos
• El super admin puede extender trials manualmente

Monitoreo
• Ver uso actual vs límites del plan (envíos, usuarios, sucursales)
• Alertas cuando un tenant se acerca a sus límites
• Historial de cambios de plan`
    },
    {
      title: '7. SISTEMA DE FEDERACIÓN',
      content: `Acceso: Menú lateral > Empresas Asociadas

Qué es la Federación
Permite que dos empresas (tenants) colaboren derivando envíos entre sí,
manteniendo sus datos completamente separados.

Crear Partnership
1. Ir a "Empresas Asociadas"
2. Buscar empresa por nombre o slug
3. Enviar solicitud de asociación
4. La empresa destino recibe una notificación
5. Al aceptar, la partnership queda activa

Derivar Envíos
1. Desde la lista de envíos, seleccionar "Derivar"
2. Elegir la empresa asociada destino
3. Confirmar derivación
4. Se crea un envío pendiente en el sistema del partner
5. El partner acepta y se genera un envío local con tracking propio

Permisos de Partnership
• Puede derivar: Habilita la derivación de envíos
• Ver precio: El partner puede ver el precio del envío original
• Ver cliente: El partner puede ver datos del remitente
• Cambiar estado: El partner puede modificar estados

Sincronización
• Los cambios de estado se reflejan en ambos sistemas
• El tracking externo del envío destino apunta al tracking origen
• Se mantiene un log completo de eventos entre partners`
    },
    {
      title: '8. SOLICITUDES DE TRIAL',
      content: `Acceso: Menú lateral > Solicitudes de Trial

Flujo de Solicitudes
1. Un visitante completa el formulario de prueba en la landing page
2. Se registra la solicitud con datos de contacto y empresa
3. El super admin revisa las solicitudes pendientes

Revisar Solicitudes
• Ver listado de solicitudes con estado (pendiente, aprobada, rechazada)
• Ver datos del solicitante: nombre, email, empresa, teléfono
• Aprobar: Se envía email de bienvenida con instrucciones
• Rechazar: Se registra el motivo

Rate Limiting
• Máximo 20 solicitudes por hora (protección anti-spam)
• Se valida por IP y por email

Después de Aprobar
• El solicitante recibe instrucciones para crear su cuenta
• Se le asigna un plan trial de 14 días
• Puede comenzar a configurar sucursales y crear envíos`
    },
    {
      title: '9. MONITOREO Y REPORTES',
      content: `Dashboard General
• Total de tenants activos
• Envíos procesados en el período
• Ingresos consolidados
• Choferes activos en todas las empresas

Reportes por Tenant
• Uso de envíos vs límite del plan
• Cantidad de usuarios activos
• Sucursales operativas
• Último login de administradores

Auditoría
• Todas las acciones del super admin quedan registradas
• Historial de cambios en tenants (activación/desactivación)
• Log de API Keys generadas y revocadas
• Eventos de federación entre partners`
    },
    {
      title: '10. BUENAS PRÁCTICAS',
      content: `Seguridad
• Cambiar contraseña regularmente
• No compartir credenciales de super admin
• Revocar API Keys que no estén en uso
• Revisar logs de acceso periódicamente

Gestión de Tenants
• Verificar datos de empresa antes de activar
• Configurar límites apropiados según el plan
• Monitorear uso para detectar anomalías
• Mantener actualizada la información de contacto

Soporte
• Ante problemas técnicos, revisar logs del sistema
• Para consultas de facturación, contactar al equipo de finanzas
• Documentar procedimientos internos y excepciones
• Mantener esta guía accesible para el equipo de soporte`
    }
  ]
};

const PRIMARY_COLOR: [number, number, number] = [139, 92, 246]; // Purple for super admin

export const generateSuperAdminGuidePDF = async (): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;

  const logoBase64 = await loadLogoAsBase64();

  const generatedDate = new Date().toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const addFooter = () => {
    addPageFooter(doc, pageWidth, pageHeight, generatedDate);
  };

  const addHeader = () => {
    addPageHeader(doc, logoBase64, 'Guía de Super Administrador - Geologistick', pageWidth, margin);
  };

  const checkNewPage = (neededHeight: number, withHeader = true) => {
    if (yPosition + neededHeight > pageHeight - 30) {
      addFooter();
      doc.addPage();
      if (withHeader) {
        addHeader();
      }
      yPosition = 30;
      return true;
    }
    return false;
  };

  // === COVER PAGE ===
  drawCoverPage(
    doc,
    logoBase64,
    'Geologistick',
    'Sistema de Gestión Logística',
    'Guía de Super Administrador',
    'Manual de administración del sistema',
    pageWidth,
    PRIMARY_COLOR
  );

  // === TABLE OF CONTENTS ===
  doc.addPage();
  addHeader();
  yPosition = 35;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text('Índice de Contenidos', margin, yPosition);
  yPosition += 15;

  doc.setDrawColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.setLineWidth(1);
  doc.line(margin, yPosition - 5, margin + 60, yPosition - 5);
  yPosition += 5;

  GUIDE_CONTENT.sections.forEach((section, index) => {
    checkNewPage(10);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.text(`${section.title}`, margin + 5, yPosition);

    // Dotted line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    const titleWidth = doc.getTextWidth(section.title);
    const pageNumStr = `${index + 3}`;
    const pageNumWidth = doc.getTextWidth(pageNumStr);
    const dotStart = margin + 5 + titleWidth + 5;
    const dotEnd = pageWidth - margin - pageNumWidth - 5;
    for (let x = dotStart; x < dotEnd; x += 3) {
      doc.line(x, yPosition, x + 1, yPosition);
    }

    doc.setTextColor(100, 100, 100);
    doc.text(pageNumStr, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 8;
  });

  addFooter();

  // === CONTENT SECTIONS ===
  GUIDE_CONTENT.sections.forEach((section) => {
    doc.addPage();
    drawSectionHeader(doc, section.title, pageWidth, PRIMARY_COLOR);
    yPosition = 40;

    const lines = section.content.split('\n');

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        yPosition += 4;
        return;
      }

      // Subheading
      if (
        trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.startsWith('•') && !trimmed.startsWith('-') && !trimmed.match(/^\d+\./)
      ) {
        checkNewPage(15);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
        doc.text(trimmed, margin, yPosition);
        yPosition += 8;
        return;
      }

      // Bold line (no bullet, no number, short)
      if (!trimmed.startsWith('•') && !trimmed.startsWith('-') && !trimmed.match(/^\d+\./) && trimmed.length < 60 && !trimmed.includes(':')) {
        checkNewPage(12);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text(trimmed, margin, yPosition);
        yPosition += 7;
        return;
      }

      // Bullet point
      if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
        checkNewPage(10);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(70, 70, 70);
        const bulletText = trimmed.substring(1).trim();
        const wrappedLines = doc.splitTextToSize(bulletText, contentWidth - 10);
        doc.text('•', margin + 3, yPosition);
        doc.text(wrappedLines, margin + 10, yPosition);
        yPosition += wrappedLines.length * 5 + 2;
        return;
      }

      // Numbered step
      const numberMatch = trimmed.match(/^(\d+)\.\s(.+)/);
      if (numberMatch) {
        checkNewPage(10);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
        doc.text(`${numberMatch[1]}.`, margin + 3, yPosition);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(70, 70, 70);
        const stepLines = doc.splitTextToSize(numberMatch[2], contentWidth - 15);
        doc.text(stepLines, margin + 12, yPosition);
        yPosition += stepLines.length * 5 + 2;
        return;
      }

      // Regular text
      checkNewPage(10);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(70, 70, 70);
      const wrappedLines = doc.splitTextToSize(trimmed, contentWidth);
      doc.text(wrappedLines, margin, yPosition);
      yPosition += wrappedLines.length * 5 + 2;
    });

    addFooter();
  });

  doc.save('guia-super-admin-geologistick.pdf');
};
