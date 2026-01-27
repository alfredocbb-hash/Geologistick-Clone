import { jsPDF } from 'jspdf';

const GUIDE_CONTENT = {
  title: 'Guía de Usuario - Geologistick',
  subtitle: 'Sistema de Gestión Logística',
  sections: [
    {
      title: '1. INICIO DE SESIÓN',
      content: `Acceso al Sistema
• Abrir la aplicación (web o APK)
• Ingresar correo electrónico y contraseña
• Presionar "Iniciar Sesión"

Navegación Principal
• Menú lateral (Sidebar): Accede a todas las funciones según tu rol
• Encabezado: Muestra tu perfil, notificaciones y opción de cerrar sesión`
    },
    {
      title: '2. DASHBOARD (Panel Principal)',
      content: `Estadísticas Generales
• Total de envíos: Cantidad total en el sistema
• En tránsito: Envíos actualmente en movimiento
• Ingresos: Total facturado
• Choferes activos: Cantidad de choferes en ruta

Envíos Recientes
Lista de los últimos envíos con su estado y destino

Resumen Diario
• Entregas completadas
• Envíos pendientes
• Incidentes reportados`
    },
    {
      title: '3. GESTIÓN DE ENVÍOS',
      content: `3.1 Crear Nuevo Envío (/shipments/new)

Paso 1: Tipo de Servicio
• Sucursal a Sucursal: Cliente despacha y retira en sucursales
• Sucursal a Puerta: Despacha en sucursal, entrega a domicilio
• Puerta a Sucursal: Retiro a domicilio, retira en sucursal
• Puerta a Puerta: Retiro y entrega a domicilio

Paso 2: Datos del Remitente
• Nombre, apellido, teléfono
• DNI/CUIT (para cuenta corriente)
• Dirección (si es retiro a domicilio)

Paso 3: Datos del Destinatario
• Nombre, apellido, teléfono
• Dirección de entrega (si es entrega a domicilio)
• Sucursal destino (si retira en sucursal)

Paso 4: Información del Paquete
• Descripción del contenido
• Peso (kg), Dimensiones
• Valor declarado, Cantidad de bultos

Paso 5: Forma de Pago
• Contado
• Cuenta Corriente
• Pago Contra Entrega

3.2 Lista de Envíos (/shipments)

Funciones disponibles:
• Buscar por tracking, remitente o destinatario
• Filtrar por estado
• Ver detalles y historial del envío
• Imprimir etiqueta
• Cambiar estado (solo admin/supervisor)
• Cancelar envío

Estados del Envío:
• Pendiente (Amarillo): Esperando retiro
• Recogido (Azul): Retirado del origen
• En Bodega (Púrpura): En almacén/sucursal
• En Tránsito (Azul): Viajando entre sucursales
• En Reparto (Naranja): En manos del repartidor
• Entregado (Verde): Entrega completada
• Devuelto (Rojo): No se pudo entregar
• Cancelado (Gris): Envío cancelado

3.3 Tracking Público (/tracking)
Página pública para que clientes rastreen sus envíos:
• Ingresar número de tracking
• Ver estado actual con progreso visual
• Ver historial de movimientos`
    },
    {
      title: '4. ESCANEO QR',
      content: `Acciones Rápidas según rol:

Para Choferes:
• Colectar: Escanear para confirmar retiro en domicilio

Para Operadores (Centro Logístico):
• Recibir en Centro: Registrar entrada de envíos

Para Sucursales:
• Recibir en Sucursal: Registrar entrada de envíos
• Recibir Hoja de Ruta: Recepción masiva de envíos

Escaneo General
• Escanear cualquier QR y el sistema determina la acción según el estado

Búsqueda Manual
• Ingresar tracking manualmente si el QR no funciona`
    },
    {
      title: '5. HOJAS DE RUTA',
      content: `Qué es una Hoja de Ruta
Documento que agrupa envíos para transferir entre sucursales

Crear Hoja de Ruta
1. Clic en "Nueva Hoja de Ruta"
2. Seleccionar sucursal destino
3. Seleccionar envíos a incluir
4. Asignar chofer y vehículo (opcional)
5. Agregar notas
6. Crear e imprimir

Estados de Hoja de Ruta
• Pendiente: Creada, esperando inicio
• En Tránsito: Chofer en camino
• Recibida: Llegó a destino
• Cancelada: Anulada`
    },
    {
      title: '6. PLANIFICADOR DE RUTAS',
      content: `Crear Ruta de Reparto
1. Seleccionar envíos disponibles (retiros o entregas)
2. Asignar chofer y vehículo
3. Elegir fecha y hora de inicio
4. Optimizar ruta automáticamente o manual

Mapa Interactivo
• Ver ubicación de sucursales
• Ver envíos seleccionados en el mapa
• Geolocalizar direcciones sin coordenadas

Optimización de Ruta
El sistema sugiere el mejor orden considerando:
• Distancia total
• Tiempo estimado

Reordenar Paradas
Arrastrar y soltar para cambiar el orden

Rutas Frecuentes
El planificador incluye un tab de "Rutas Frecuentes" donde puedes:
• Ver plantillas guardadas
• Usar una ruta para pre-cargar envíos pendientes
• Crear nuevas plantillas desde rutas exitosas`
    },
    {
      title: '7. MIS RUTAS (Para Choferes)',
      content: `Vista General
Muestra todas las rutas y hojas asignadas:
• Por Iniciar: Rutas pendientes
• En Curso: Rutas activas
• Completadas: Rutas finalizadas

Tipos de Asignaciones

Hojas de Ruta (Transferencias):
• Transportar envíos entre sucursales
• Botón "Recolectar": Escanear/confirmar envíos
• Botón "Iniciar": Comenzar el viaje

Rutas Planificadas (Reparto):
• Entregas y retiros a domicilio
• Muestra progreso (paradas completadas / total)

Iniciar Ruta
1. Presionar "Iniciar" en la ruta deseada
2. Confirmar inicio con resumen de paradas

Recolectar Envíos
1. Presionar "Recolectar"
2. Seleccionar envíos que estás cargando
3. Confirmar - los envíos cambian a "en_transito"`
    },
    {
      title: '8. NAVEGACIÓN ACTIVA',
      content: `Encabezado
• Número de ruta
• Porcentaje de progreso
• Botón para cerrar ruta

Estadísticas
• Paradas pendientes
• Completadas
• Fallidas

Próxima Parada
• Nombre del contacto
• Dirección y teléfono
• Botones: Navegar (Google Maps), Llamar, WhatsApp

Confirmar Entrega (EPOD)
1. Presionar en la parada actual
2. Tomar foto del paquete entregado o comprobante
3. Capturar firma digital del receptor
4. Agregar nombre de quien recibe (opcional)
5. Incluir notas adicionales si es necesario
6. Confirmar - se genera el EPOD automáticamente

El EPOD (Electronic Proof of Delivery) incluye:
• Foto del comprobante
• Firma digital
• Fecha y hora exacta
• Coordenadas GPS de entrega
• Nombre del receptor

Reportar Problema
• Ausente en domicilio
• Dirección incorrecta
• Rechazó el paquete
• Otro problema

Reprogramar Entrega
• Seleccionar nueva fecha
• Agregar motivo
• Confirmar reprogramación`
    },
    {
      title: '9. MAPA EN VIVO',
      content: `Funcionalidades
• Ver ubicación en tiempo real de choferes
• Ver sucursales en el mapa
• Filtrar por estado de envío
• Ver rutas activas`
    },
    {
      title: '10. FINANZAS',
      content: `Control de Caja (/cash)
• Registrar movimientos de efectivo
• Ver saldo actual
• Cuadre de caja

Liquidaciones

Sucursales (/settlements/branches):
• Ver ingresos por sucursal
• Generar liquidaciones

Choferes (/settlements/drivers):
• Calcular comisiones
• Registrar pagos

Clientes (/settlements/clients):
• Gestionar cuentas corrientes
• Ver saldos pendientes

Terciarizados (/third-party-settlements):
• Gestionar cuentas con proveedores externos
• Registrar pagos a Correo Argentino, OCA, etc.
• Ver historial de movimientos por empresa

Mis Comisiones (/my-commissions)
• Ver comisiones ganadas
• Historial de pagos`
    },
    {
      title: '11. ADMINISTRACIÓN',
      content: `Sucursales (/admin/branches)
• Crear/editar sucursales
• Configurar permisos de despacho/recepción
• Marcar como centro logístico

Tarifas (/admin/rates)
• Crear tarifas base
• Configurar conceptos adicionales
• Precio por kg

Usuarios (/admin/users)
• Crear usuarios
• Asignar roles y sucursal
• Activar/desactivar

Gestión de Roles (/admin/roles)
• Configurar permisos por rol
• Crear roles personalizados

Choferes (/drivers)
• Ver lista de choferes
• Asignar vehículos
• Ver disponibilidad

Vehículos (/vehicles)
• Registrar vehículos
• Estados: disponible, en ruta, mantenimiento
• Datos: patente, marca, modelo, capacidad`
    },
    {
      title: '12. CLIENTES',
      content: `Gestión de Clientes
• Crear clientes con datos de contacto
• Habilitar cuenta corriente
• Configurar límite de crédito
• Ver historial de envíos`
    },
    {
      title: '13. FLUJO COMPLETO DE UN ENVÍO',
      content: `Escenario 1: Sucursal a Sucursal
1. Cliente trae paquete a Sucursal A → Estado: en_bodega
2. Operador crea hoja de ruta hacia Sucursal B
3. Chofer recoge hoja de ruta → Estado: en_transito
4. Chofer llega a Sucursal B → Estado: en_bodega
5. Cliente retira en Sucursal B → Estado: entregado

Escenario 2: Puerta a Puerta
1. Operador crea envío con retiro → Estado: pendiente
2. Planificador crea ruta de retiros
3. Chofer retira del domicilio → Estado: recogido
4. Chofer regresa a sucursal → Estado: en_bodega
5. Se crea hoja de ruta hacia destino → Estado: en_transito
6. Llegada a sucursal destino → Estado: en_bodega
7. Planificador crea ruta de entregas
8. Chofer entrega en domicilio → Estado: entregado`
    },
    {
      title: '14. ATAJOS Y TIPS',
      content: `Para Choferes
• Usa el escáner QR para confirmar retiros/entregas
• El botón "Navegar" abre Google Maps
• Puedes llamar o enviar WhatsApp desde la app
• Siempre toma foto del comprobante de entrega

Para Operadores
• Usa "Recibir Hoja de Ruta" para recibir múltiples envíos
• Revisa el historial de envíos si hay dudas
• Geolocaliza direcciones desde el planificador

Para Administradores
• Revisa las liquidaciones pendientes regularmente
• Mantén actualizadas las tarifas
• Usa el mapa en vivo para monitorear operaciones`
    },
    {
      title: '15. SOLUCIÓN DE PROBLEMAS',
      content: `QR no escanea
• Verificar permisos de cámara en el dispositivo
• Probar con buena iluminación
• Usar búsqueda manual como alternativa

Envío no aparece
• Verificar filtros activos
• Buscar por tracking exacto
• Revisar si está en otra sucursal

No puedo cambiar estado
• Solo admin/supervisor pueden cambiar estados manualmente
• Verificar que el envío no esté cancelado o entregado

Mapa no carga
• Verificar conexión a internet
• Revisar configuración de API Key de Google Maps`
    },
    {
      title: '16. RUTAS FRECUENTES',
      content: `Qué son las Rutas Frecuentes
Plantillas de rutas guardadas que agilizan la planificación diaria.
El sistema identifica automáticamente envíos pendientes de los clientes habituales.

Cómo Guardar una Ruta Frecuente
1. Crear ruta en el Planificador
2. Una vez optimizada, clic en "Guardar como Frecuente"
3. Asignar nombre descriptivo
4. Confirmar paradas y clientes

Usar Ruta Frecuente
1. Ir a Planificador de Rutas > tab "Rutas Frecuentes"
2. Seleccionar la ruta deseada
3. El sistema busca envíos pendientes de esos clientes
4. Clic "Usar Ruta" para pre-cargar los envíos encontrados
5. Ajustar si es necesario y crear la ruta

Beneficios
• Acelera la planificación diaria
• Mantiene consistencia en zonas de reparto
• Reduce errores de asignación`
    },
    {
      title: '17. EMPRESAS TERCIARIZADAS (3PL)',
      content: `Qué son las Empresas Terciarizadas
Proveedores logísticos externos (ej: Correo Argentino, OCA) para envíos fuera de la zona de cobertura.

Gestión de Empresas (/third-party-companies)
• Crear empresas con datos de contacto
• Configurar tipos de servicio disponibles
• Habilitar cuenta corriente para cada empresa
• Ver historial de envíos asignados

Cuenta Corriente de Terciarizados
Si la empresa tiene cuenta corriente habilitada:
• Cada envío genera un cargo automático
• Se pueden registrar pagos parciales o totales
• Ver saldo y movimientos en tiempo real

Crear Envíos Terciarizados
Desde el Planificador > tab "Envíos Terciarizados":
1. Seleccionar empresa terciarizada
2. Ingresar datos del destinatario
3. Agregar tracking externo (opcional)
4. El sistema registra el cargo en cuenta corriente

Liquidaciones de Terciarizados (/third-party-settlements)
• Ver saldos por empresa
• Registrar pagos con referencia
• Consultar historial de movimientos`
    },
    {
      title: '18. WIDGET DE TRACKING EMBEBIBLE',
      content: `Qué es el Widget de Tracking
Página minimalista para integrar en sitios web de clientes vía iframe.
Permite a los compradores rastrear sus envíos sin salir del sitio del vendedor.

URL del Widget
/tracking-embed

Parámetros URL
• tracking: Código de envío pre-cargado
• tenant_slug: Identificador del tenant para branding

Ejemplo de Integración
<iframe src="https://geologistick.app/tracking-embed?tenant_slug=miempresa" width="100%" height="600" />

Características
• Sin header ni navegación (ideal para iframe)
• Muestra branding del tenant (logo, colores)
• Barra de progreso visual
• Historial completo de movimientos
• Búsqueda por código de tracking`
    },
    {
      title: '19. MÓDULO E-COMMERCE (Referencia)',
      content: `Acceso
El módulo completo se encuentra en e-Commerce en el menú lateral.

Funciones Principales
• Sellers: Gestionar tiendas online conectadas
• Pedidos: Ver órdenes sincronizadas de Tiendanube
• Liquidaciones: Cierre periódico de cuentas de sellers

Integración con Tiendanube
• Sincronización automática de pedidos
• Cotización de envíos en el checkout
• Actualización de estados de fulfillment

Portal de Sellers
Los vendedores acceden en /seller con dashboard, pedidos, envíos y cuenta.

Documentación Completa
Descargar la "Guía de e-Commerce" desde Configuración del Sistema para el manual detallado.`
    }
  ]
};

export const generateUserGuidePDF = (): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;

  // Helper function to add page number
  const addPageNumber = () => {
    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Página ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  };

  // Helper function to check if we need a new page
  const checkNewPage = (neededHeight: number) => {
    if (yPosition + neededHeight > pageHeight - 30) {
      addPageNumber();
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Cover Page
  doc.setFillColor(59, 130, 246); // Blue
  doc.rect(0, 0, pageWidth, 80, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('Geologistick', pageWidth / 2, 40, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Gestión Logística', pageWidth / 2, 55, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Guía de Usuario', pageWidth / 2, 110, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Manual Completo del Sistema', pageWidth / 2, 125, { align: 'center' });
  
  const date = new Date().toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  doc.text(`Generado: ${date}`, pageWidth / 2, 145, { align: 'center' });

  // Table of Contents
  addPageNumber();
  doc.addPage();
  yPosition = margin;
  
  doc.setTextColor(59, 130, 246);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Índice de Contenidos', margin, yPosition);
  yPosition += 15;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  GUIDE_CONTENT.sections.forEach((section, index) => {
    checkNewPage(8);
    doc.text(`${section.title}`, margin, yPosition);
    yPosition += 8;
  });

  // Content Sections
  GUIDE_CONTENT.sections.forEach((section) => {
    addPageNumber();
    doc.addPage();
    yPosition = margin;

    // Section Title
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 25, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, margin, 17);
    
    yPosition = 40;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Split content into lines
    const lines = section.content.split('\n');
    
    lines.forEach((line) => {
      if (line.trim() === '') {
        yPosition += 4;
        return;
      }

      // Check if it's a subsection header (no bullet, not indented)
      const isBold = !line.startsWith('•') && !line.startsWith(' ') && line.length < 60;
      
      if (isBold) {
        checkNewPage(12);
        yPosition += 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
      }

      // Word wrap
      const wrappedLines = doc.splitTextToSize(line, contentWidth);
      
      wrappedLines.forEach((wrappedLine: string) => {
        checkNewPage(7);
        doc.text(wrappedLine, margin, yPosition);
        yPosition += 6;
      });

      if (isBold) {
        yPosition += 2;
      }
    });
  });

  // Add final page number
  addPageNumber();

  // Download
  doc.save('guia-usuario-geologistick.pdf');
};
