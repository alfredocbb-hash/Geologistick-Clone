import { jsPDF } from 'jspdf';
import { 
  loadLogoAsBase64, 
  addPageHeader, 
  addPageFooter, 
  drawCoverPage, 
  drawSectionHeader 
} from './pdfHelpers';

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
• Incidentes reportados

Gráfico Semanal
Visualización de envíos por día de la semana actual con tendencia

Top Choferes
Ranking de los choferes con mejor desempeño del período`
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
• Autocompletado de contactos frecuentes

Paso 3: Datos del Destinatario
• Nombre, apellido, teléfono
• Dirección de entrega (si es entrega a domicilio)
• Sucursal destino (si retira en sucursal)

Paso 4: Información del Paquete
• Descripción del contenido
• Peso (kg), Dimensiones (alto, ancho, largo)
• Valor declarado, Cantidad de bultos

Paso 5: Forma de Pago
• Contado
• Cuenta Corriente
• Pago Contra Entrega (COD)

3.2 Lista de Envíos (/shipments)

Funciones disponibles:
• Buscar por tracking, remitente o destinatario
• Filtrar por estado, fecha, sucursal
• Ver detalles y historial del envío
• Imprimir etiqueta
• Cambiar estado (solo admin/supervisor)
• Cancelar envío

Estados del Envío:
• Pendiente (Amarillo): Esperando retiro
• Recogido (Azul): Retirado del origen
• En Sucursal (Púrpura): Recibido en sucursal
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
      title: '4. ESCANEO QR Y OCR',
      content: `Escaneo QR
Acciones Rápidas según rol:

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
• Ingresar tracking manualmente si el QR no funciona

OCR Masivo (Ingreso con IA)
Permite ingresar paquetes escaneando etiquetas impresas con la cámara, sin necesidad de código QR.

Modos de OCR:
• Modo Ráfaga: Captura continua foto tras foto. Ideal para escanear muchas etiquetas rápidamente.
• Modo Álbum: Seleccionar fotos ya tomadas de la galería del dispositivo.

Cómo Funciona:
1. Abrir el escáner y seleccionar "OCR Masivo"
2. Capturar fotos de las etiquetas (una por foto)
3. El sistema procesa todas las fotos en paralelo usando IA
4. Se extraen: tracking, remitente, destinatario, dirección, bultos
5. Si los datos esenciales se detectan correctamente, se auto-confirma
6. Si hay errores, se muestra un formulario de edición manual
7. Al finalizar, los envíos quedan creados y listos para colectar

Auto-confirmación
Si la IA detecta tracking + dirección + destinatario, el envío se crea automáticamente sin intervención. Los envíos con datos incompletos pasan a edición manual.

Geocodificación Automática
Las direcciones extraídas se geocodifican automáticamente para obtener coordenadas GPS.

Disponibilidad
El OCR está disponible en:
• App móvil del chofer (escáner)
• Planificador de rutas (administración)
• Módulo Flex`
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

Geolocalización Masiva
El botón "Geolocalizar Todos (N)" permite geolocalizar todos los envíos sin coordenadas en un solo clic:
• Procesa los envíos de a uno, con pausa entre cada uno para no saturar la API
• Muestra barra de progreso en tiempo real
• Al finalizar, muestra resumen: X exitosos, Y fallidos
• Los envíos geolocalizados aparecen inmediatamente en el mapa

Normalización de Ciudades
El planificador agrupa envíos por ciudad con normalización inteligente:
• Variantes como "La Plata", "LA PLATA NORTE", "LA PLATA OESTE" se agrupan bajo "LA PLATA"
• Se eliminan sufijos comunes (norte, sur, este, oeste, centro)
• El conteo refleja el total real de envíos por ciudad base

Importación CSV
Desde el planificador se pueden importar envíos masivamente:
1. Clic en "Importar CSV"
2. Seleccionar archivo Excel o CSV
3. Mapear columnas del archivo a campos del sistema
4. Previsualizar datos antes de importar
5. Confirmar importación

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
• Crear nuevas plantillas desde rutas exitosas

Envíos Terciarizados
Tab dedicado para derivar envíos a empresas externas (Correo Argentino, OCA, etc.)`
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

Cobro Contra Entrega (COD)
Si el envío tiene pago contra entrega:
1. Seleccionar método de pago (efectivo, transferencia, etc.)
2. Confirmar monto cobrado
3. El sistema registra el cobro para rendición posterior

Devoluciones y Cambios
Al confirmar una entrega exitosa, el sistema pregunta si hay devolución:
1. Seleccionar "Sí, hay devolución" en el diálogo de cambio
2. Se crea automáticamente un envío inverso en estado "recogido"
3. El envío inverso se vincula al original vía envio_cambio_id
4. El destino se determina automáticamente:
   • Envíos Mercado Libre: dirección del vendedor
   • Envíos manuales: remitente o sucursal de origen
5. El chofer ve el nuevo envío de devolución en su lista

Nota: El diálogo de cambio solo aparece en entregas de envíos estándar, no en envíos que ya son devoluciones (es_cambio: true).

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
• Ver rutas activas

Filtros de Choferes
• Filtrar por nombre, estado (activo/inactivo), zona
• Ver solo choferes con ruta activa
• Buscar chofer específico

Panel de Detalle de Chofer
Al seleccionar un chofer en el mapa:
• Información personal y vehículo asignado
• Ruta activa con paradas pendientes/completadas
• Último check-in y ubicación actualizada
• Historial de entregas del día

Mapa de Calor (Heatmap)
Visualización de densidad de envíos por zona:
• Muestra concentración de entregas/retiros en el mapa
• Útil para identificar zonas de alta demanda
• Ayuda a planificar rutas más eficientes
• Activar/desactivar desde los controles del mapa

Análisis de Ruta con IA
Desde el panel de detalle del chofer:
• Analizar el rendimiento de la ruta actual
• Obtener sugerencias de optimización
• Ver métricas: distancia recorrida, tiempo promedio por parada`
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
• Generar liquidaciones por período
• Desglose de conceptos (flete, retiro, entrega, adicionales)

Choferes (/settlements/drivers):
• Calcular comisiones por entrega
• Registrar pagos
• Ver resumen de envíos entregados y montos

Clientes (/settlements/clients):
• Gestionar cuentas corrientes
• Ver saldos pendientes
• Registrar pagos

Terciarizados (/third-party-settlements):
• Gestionar cuentas con proveedores externos
• Registrar pagos a Correo Argentino, OCA, etc.
• Ver historial de movimientos por empresa

Rendiciones de Choferes (COD)
Cuando el chofer cobra contra entrega:
• Los cobros se registran automáticamente
• El supervisor puede ver el total a rendir por chofer
• Se registra la rendición cuando el chofer entrega el dinero
• Detalle de cada cobro con método de pago

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
• Configurar zonas de cobertura en el mapa

Tarifas (/admin/rates)
• Crear tarifas base
• Configurar conceptos adicionales
• Precio por kg, volumen, distancia, zona o código postal
• Configurar seguro (base, porcentaje, topes)

Usuarios (/admin/users)
• Crear usuarios
• Asignar roles y sucursal
• Activar/desactivar

Gestión de Roles (/admin/roles)
• Configurar permisos por rol
• Permisos granulares por categoría

Choferes (/drivers)
• Ver lista de choferes
• Asignar vehículos
• Ver disponibilidad y último check-in

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
• Ver historial de envíos
• Autocompletado al crear envíos`
    },
    {
      title: '13. CHECK-IN / CHECK-OUT DE CHOFERES',
      content: `Inicio de Jornada (Check-In)
Al abrir la app móvil, el chofer debe iniciar su jornada:
1. Se muestra la pantalla de "Iniciar Jornada"
2. El chofer presiona el botón de inicio
3. Se registra automáticamente:
   • Fecha y hora del check-in
   • Ubicación GPS
   • Precisión del GPS
   • Información del dispositivo
4. Se sincroniza la ubicación en driver_locations

Fin de Jornada (Check-Out)
Al finalizar el día:
1. Ir a Perfil > "Finalizar Jornada"
2. Confirmar el cierre
3. Se registra la hora de check-out

Consideraciones
• El check-in es obligatorio antes de poder operar en la app
• Si ya hizo check-in hoy, se salta automáticamente la pantalla
• Los supervisores pueden ver los check-ins de todos los choferes
• El registro queda asociado al tenant del chofer`
    },
    {
      title: '14. COLECTAS',
      content: `Qué es una Colecta
Proceso de recoger múltiples paquetes de forma masiva, generalmente al inicio de la jornada o en un punto de recolección.

Flujo de Colecta
1. Desde el escáner, seleccionar modo "Colectar"
2. Escanear los paquetes uno a uno (QR o OCR)
3. Cada paquete se agrega a la lista de colecta
4. Al finalizar, presionar "Confirmar Colecta"
5. Todos los envíos cambian a estado "recogido"
6. Se asigna el chofer actual como chofer_id
7. Se crea un registro en la tabla de colectas

Colecta desde OCR Masivo
1. Usar OCR Masivo para escanear todas las etiquetas
2. Al procesar las fotos, los envíos se crean automáticamente
3. Presionar "COLECTAR" para agregar todos a la colecta
4. Confirmar la colecta masiva
5. El chofer ve los paquetes colectados en su pantalla principal

Visibilidad del Chofer
Los paquetes colectados aparecen en:
• Pantalla principal: sección "Colectas hoy" con el total
• Tab de entregas: filtrados por estado "recogido" y chofer asignado`
    },
    {
      title: '15. FLUJO COMPLETO DE UN ENVÍO',
      content: `Escenario 1: Sucursal a Sucursal
1. Cliente trae paquete a Sucursal A → Estado: en_sucursal
2. Operador crea hoja de ruta hacia Sucursal B
3. Chofer recoge hoja de ruta → Estado: en_transito
4. Chofer llega a Sucursal B → Estado: en_sucursal
5. Cliente retira en Sucursal B → Estado: entregado

Escenario 2: Puerta a Puerta
1. Operador crea envío con retiro → Estado: pendiente
2. Planificador crea ruta de retiros
3. Chofer retira del domicilio → Estado: recogido
4. Chofer regresa a sucursal → Estado: en_sucursal
5. Se crea hoja de ruta hacia destino → Estado: en_transito
6. Llegada a sucursal destino → Estado: en_sucursal
7. Planificador crea ruta de entregas
8. Chofer entrega en domicilio → Estado: entregado

Escenario 3: Entrega con Devolución
1. Chofer llega al domicilio y entrega el paquete
2. El destinatario tiene un paquete para devolver
3. El chofer confirma la entrega y marca "hay devolución"
4. Se crea automáticamente un envío inverso (recogido)
5. El envío de devolución se incluye en la siguiente ruta hacia el origen`
    },
    {
      title: '16. ATAJOS Y TIPS',
      content: `Para Choferes
• Usa el escáner QR o OCR para confirmar retiros/entregas
• El botón "Navegar" abre Google Maps
• Puedes llamar o enviar WhatsApp desde la app
• Siempre toma foto del comprobante de entrega
• Iniciá la jornada (Check-In) al comenzar el día

Para Operadores
• Usa "Recibir Hoja de Ruta" para recibir múltiples envíos
• Revisa el historial de envíos si hay dudas
• Usa "Geolocalizar Todos" en el planificador para ahorrar tiempo
• Importá envíos masivamente desde CSV

Para Administradores
• Revisa las liquidaciones pendientes regularmente
• Mantén actualizadas las tarifas
• Usa el mapa en vivo para monitorear operaciones
• Consultá el mapa de calor para identificar zonas de alta demanda`
    },
    {
      title: '17. REPORTES Y ANÁLISIS',
      content: `Reportes Disponibles (/reports)

Productividad
• Envíos por chofer, por sucursal, por período
• Tasa de entrega exitosa
• Tiempo promedio de entrega

Costos
• Análisis de costos operativos
• Comparativa de gastos por período
• Desglose por categoría

Predicción de Demanda con IA
Tab especial en Reportes que utiliza inteligencia artificial:
• Predice el volumen de envíos para los próximos días/semanas
• Basado en datos históricos del tenant
• Ayuda a planificar recursos (choferes, vehículos)
• Muestra tendencias y estacionalidad`
    },
    {
      title: '18. SOLUCIÓN DE PROBLEMAS',
      content: `QR no escanea
• Verificar permisos de cámara en el dispositivo
• Probar con buena iluminación
• Usar búsqueda manual o OCR como alternativa

Envío no aparece
• Verificar filtros activos
• Buscar por tracking exacto
• Revisar si está en otra sucursal

No puedo cambiar estado
• Solo admin/supervisor pueden cambiar estados manualmente
• Verificar que el envío no esté cancelado o entregado

Mapa no carga
• Verificar conexión a internet
• Revisar configuración de API Key de Google Maps

OCR no detecta la etiqueta
• Asegurar buena iluminación y enfoque
• La etiqueta debe estar completa y legible
• Probar con otra foto o usar edición manual`
    },
    {
      title: '19. RUTAS FRECUENTES',
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
      title: '20. EMPRESAS TERCIARIZADAS (3PL)',
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
      title: '21. WIDGET DE TRACKING EMBEBIBLE',
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
      title: '22. MÓDULO E-COMMERCE',
      content: `Acceso
El módulo completo se encuentra en e-Commerce en el menú lateral.

Funciones Principales
• Sellers: Gestionar tiendas online conectadas
• Pedidos: Ver órdenes sincronizadas
• Liquidaciones: Cierre periódico de cuentas de sellers

Integración con Tiendanube
• Sincronización automática de pedidos via webhook
• Cotización de envíos en el checkout
• Actualización de estados de fulfillment

Integración con Mercado Libre
• Conexión OAuth con cuentas de sellers
• Sincronización de envíos Flex y Full
• Descarga de etiquetas ML desde el sistema
• Estados duales: estado interno + estado ML sincronizado
• Detección automática de discrepancias entre estados
• Cuenta Logística: fallback automático para envíos sin seller registrado

Portal de Sellers
Los vendedores acceden en /seller con dashboard, pedidos, envíos y cuenta.

Documentación Completa
Descargar la "Guía de e-Commerce" desde Configuración del Sistema para el manual detallado.`
    }
  ]
};

const PRIMARY_COLOR: [number, number, number] = [59, 130, 246]; // Blue

export const generateUserGuidePDF = async (): Promise<void> => {
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

  // Helper function to add footer
  const addFooter = () => {
    addPageFooter(doc, pageWidth, pageHeight, generatedDate);
  };

  // Helper function to add header (for content pages)
  const addHeader = () => {
    addPageHeader(doc, logoBase64, 'Guía de Usuario - Geologistick', pageWidth, margin);
  };

  // Helper function to check if we need a new page
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
    'Sistema de Gestión Logística',
    'GUÍA DE USUARIO',
    'Manual Completo del Sistema',
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
  doc.text('Índice de Contenidos', margin, yPosition);
  yPosition += 12;

  // Línea decorativa
  doc.setDrawColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, margin + 60, yPosition);
  yPosition += 10;

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  GUIDE_CONTENT.sections.forEach((section) => {
    checkNewPage(8);
    // Bullet decorativo
    doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.circle(margin + 2, yPosition - 2, 1.5, 'F');
    doc.text(section.title, margin + 8, yPosition);
    yPosition += 8;
  });

  addFooter();

  // ===== CONTENT SECTIONS =====
  GUIDE_CONTENT.sections.forEach((section) => {
    doc.addPage();
    
    // Section header
    drawSectionHeader(doc, section.title, pageWidth, PRIMARY_COLOR);
    
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
        checkNewPage(14, false);
        yPosition += 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
      }

      // Word wrap
      const wrappedLines = doc.splitTextToSize(line, contentWidth);

      wrappedLines.forEach((wrappedLine: string) => {
        checkNewPage(7, false);
        doc.text(wrappedLine, margin, yPosition);
        yPosition += 6;
      });

      if (isBold) {
        yPosition += 2;
        doc.setTextColor(50, 50, 50);
      }
    });

    addFooter();
  });

  // Download
  doc.save('guia-usuario-geologistick.pdf');
};
