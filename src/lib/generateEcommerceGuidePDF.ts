import { jsPDF } from 'jspdf';

const ECOMMERCE_GUIDE_CONTENT = {
  title: 'Guia de e-Commerce',
  subtitle: 'Modulo de Tiendas Online - Geologistick',
  sections: [
    {
      title: '1. INTRODUCCION AL MODULO E-COMMERCE',
      content: `Que es el Modulo e-Commerce
El modulo e-Commerce permite a empresas logisticas ofrecer servicios de fulfillment a tiendas online. Conecta plataformas como Tiendanube directamente con el sistema de gestion, automatizando la recepcion de pedidos y el calculo de envios.

Publico Objetivo
• Tiendas online que necesitan logistica tercerizada
• Emprendedores con ventas por internet
• Empresas con multiples canales de venta

Beneficios Principales
• Automatizacion: Los pedidos llegan automaticamente al sistema
• Visibilidad: Los sellers pueden rastrear sus envios en tiempo real
• Liquidaciones: Sistema integrado de cuenta corriente y facturacion
• Cotizacion: Precios de envio calculados en el checkout de la tienda`
    },
    {
      title: '2. GESTION DE SELLERS',
      content: `Que es un Seller
Un Seller es una tienda online conectada a tu sistema logistico. Cada seller tiene su configuracion, tarifa y cuenta corriente independiente.

Crear Seller Manualmente
1. Ir a e-Commerce > Sellers
2. Clic en "Nuevo Seller"
3. Completar datos basicos: nombre, email, telefono
4. Configurar opciones avanzadas

Campos Importantes

Sucursal de Pickup
Define DONDE se retiran los paquetes del seller. Cuando llega un pedido, el sistema sabe automaticamente a que sucursal asignar el envio.

Tarifa Asignada
Determina los precios que se cobran al seller. Se usa para:
• Calcular el costo del envio al crear desde pedido
• Cotizar envios en el checkout de Tiendanube

Cuenta Corriente
Si esta habilitada, los cargos por envio se registran en la cuenta del seller en lugar de cobrar al momento.

Vincular Usuario
Permite que el seller acceda al Portal (/seller) para:
• Ver sus pedidos
• Rastrear envios
• Consultar su estado financiero`
    },
    {
      title: '3. INTEGRACION CON TIENDANUBE',
      content: `Como Funciona la Conexion
La integracion usa OAuth 2.0 para conectar de forma segura:
1. El seller autoriza la conexion desde Tiendanube
2. El sistema recibe tokens de acceso
3. Se sincronizan los pedidos automaticamente

Enviar Link de Conexion
Desde el detalle del seller:
• Boton "Enviar por WhatsApp": Envia link de autorizacion
• Boton "Enviar por Email": Envia instrucciones completas

Sincronizacion de Pedidos
• Automatica: Los pedidos llegan via webhook en tiempo real
• Manual: Boton "Sincronizar" para forzar actualizacion

Webhooks
Cuando se crea un pedido en Tiendanube:
1. Tiendanube envia notificacion al sistema
2. El pedido se registra en ecommerce_orders
3. Queda disponible para crear envio

Cotizacion en Checkout
El sistema responde automaticamente las consultas de tarifa:
• Cuando el comprador ingresa su direccion
• Se calcula usando la tarifa asignada al seller
• El precio aparece como opcion de envio en Tiendanube`
    },
    {
      title: '4. RELACION CON SUCURSALES',
      content: `Sucursal de Pickup
Cada seller tiene asignada una sucursal de pickup. Esta es la sucursal desde donde:
• Se retiran los paquetes del seller
• Se originan los envios creados desde pedidos
• Se generan las hojas de ruta

Como Asignar Sucursal
1. Editar seller
2. Seleccionar "Sucursal de Pickup"
3. Guardar cambios

Flujo Operativo

Paso 1: Configuracion
El administrador asigna "Casa Central" como sucursal de pickup de "Mi Tienda".

Paso 2: Llega Pedido
Comprador paga en Tiendanube. El webhook registra el pedido en el sistema.

Paso 3: Operador Ve Pedido
El operador de "Casa Central" ve el pedido en e-Commerce > Pedidos.

Paso 4: Crea Envio
Al crear envio desde el pedido, la sucursal_origen se asigna automaticamente como "Casa Central".

Paso 5: Operatoria Normal
El envio entra en el flujo normal: puede incluirse en hojas de ruta o rutas de reparto.

DIAGRAMA: FLUJO CON SUCURSALES

Seller "Mi Tienda"
        |
        v
Sucursal Pickup: "Casa Central"
        |
        v
Pedido de Tiendanube --> ecommerce_orders
        |
        v
Operador en "Casa Central" ve pedido
        |
        v
Crea envio --> sucursal_origen = "Casa Central"
        |
        v
Envio en hoja de ruta o ruta de reparto`
    },
    {
      title: '5. GESTION DE PEDIDOS',
      content: `Acceso
e-Commerce > Pedidos

Lista de Pedidos
Muestra todos los pedidos sincronizados con:
• Numero de orden externa
• Nombre del comprador
• Direccion de envio
• Estado del pedido
• Fecha de creacion

Estados de Pedido
• Pendiente: Esperando pago
• Pagado: Listo para procesar
• Enviado: Ya tiene envio creado
• Entregado: Completado

Estados de Fulfillment
• Sin Preparar: Pedido recien llegado
• En Preparacion: Seller preparando paquete
• Enviado: Paquete despachado

Acciones Disponibles
• Ver Detalles: Informacion completa del pedido
• Crear Envio: Genera envio desde este pedido
• Ver Envio: Si ya tiene envio, ver su tracking`
    },
    {
      title: '6. CREACION DE ENVIOS DESDE PEDIDOS',
      content: `Proceso Paso a Paso

1. Seleccionar Pedido
Desde la lista, clic en "Crear Envio" en un pedido pagado.

2. Datos Pre-cargados
El sistema completa automaticamente:
• Nombre y telefono del comprador
• Direccion de entrega
• Items del pedido (como descripcion)

3. Verificar y Ajustar
• Revisar datos del destinatario
• Verificar direccion
• Ajustar peso si es necesario

4. Calculo de Precio
El sistema calcula automaticamente usando:
• Tarifa asignada al seller
• Tipo de servicio (Puerta a Puerta)
• Conceptos adicionales si aplican

5. Registro en Cuenta Corriente
Si el seller tiene cuenta corriente:
• Se registra cargo automatico
• Actualiza saldo del seller

6. Imprimir Etiqueta
Al crear, opcion de imprimir etiqueta inmediatamente.

Resultado
• Envio creado con tracking unico
• Pedido marcado como "Enviado"
• Cargo registrado en cuenta del seller
• Listo para incluir en ruta`
    },
    {
      title: '7. CUENTA CORRIENTE DE SELLERS',
      content: `Como Funciona
Similar a la cuenta corriente de clientes, pero para sellers:
• Acumula cargos por envios creados
• Registra pagos recibidos
• Mantiene saldo actualizado

Habilitar Cuenta Corriente
1. Editar seller
2. Activar "Tiene Cuenta Corriente"
3. Opcional: Configurar limite de credito
4. Guardar

Tipos de Movimientos

Cargo
• Se genera al crear envio desde pedido
• Monto = precio del envio
• Aumenta deuda del seller

Pago
• Se registra cuando el seller paga
• Metodos: transferencia, efectivo, etc.
• Disminuye deuda del seller

Ajuste
• Correcciones manuales
• Puede ser positivo o negativo
• Requiere descripcion

Ver Estado de Cuenta
En el detalle del seller:
• Saldo actual
• Historial de movimientos
• Limite de credito disponible`
    },
    {
      title: '8. LIQUIDACIONES DE SELLERS',
      content: `Que es una Liquidacion
Es el cierre periodico de la cuenta corriente, donde se totalizan los movimientos de un periodo.

Generar Liquidacion
1. Ir a e-Commerce > Liquidaciones
2. Clic "Nueva Liquidacion"
3. Seleccionar seller
4. Definir periodo (fecha inicio - fecha fin)
5. El sistema calcula automaticamente:
   • Saldo anterior
   • Total de cargos del periodo
   • Total de pagos del periodo
   • Saldo final

Estados de Liquidacion
• Generada: Calculada, pendiente de aprobacion
• Aprobada: Verificada por supervisor
• Pagada: Seller abono el total
• Cancelada: Anulada (solo si no esta pagada)

Registrar Pago
1. Seleccionar liquidacion
2. Clic "Registrar Pago"
3. Ingresar:
   • Metodo de pago
   • Referencia (nro transferencia, etc)
   • Fecha de pago
4. Confirmar

Descargar PDF
Cada liquidacion genera un PDF oficial con:
• Datos del seller
• Detalle de movimientos
• Totales
• Estado de pago`
    },
    {
      title: '9. PORTAL DE SELLERS',
      content: `Acceso
Los sellers acceden en: /seller
Con su usuario y contrasena vinculados.

Dashboard
Vista general con:
• Total de pedidos del mes
• Envios en transito
• Entregas completadas
• Saldo de cuenta corriente

Mis Pedidos
Lista de ordenes de su tienda:
• Ver detalle de cada pedido
• Estado actual
• Envio asociado (si existe)

Mis Envios
Rastreo de todos sus paquetes:
• Tracking number
• Estado actual
• Historial de movimientos
• Filtros por fecha y estado

Mi Cuenta
Seccion financiera:
• Saldo actual
• Movimientos recientes
• Solicitar retiro (si tiene saldo a favor)
• Ver liquidaciones

Beneficios del Portal
• El seller consulta sin llamar
• Visibilidad completa de operaciones
• Autoservicio para tracking
• Transparencia financiera`
    },
    {
      title: '10. TARIFAS PARA E-COMMERCE',
      content: `Asignar Tarifa a Seller
1. Editar seller
2. Seleccionar tarifa en "Tarifa Asignada"
3. Guardar

Importante: Asignar tarifa ANTES de conectar Tiendanube para que funcione la cotizacion.

Como se Calcula el Precio
Cuando se crea envio o se cotiza:

1. Flete Base
Precio base de la tarifa

2. Conceptos Basicos
• Tipo de servicio (ej: Puerta a Puerta)
• Adicionales fijos

3. Adicionales por Peso
• Precio por kg excedente
• Se calcula sobre peso declarado

Ejemplo de Calculo
Tarifa "E-Commerce Standard":
• Flete base: $500
• Puerta a Puerta: $300
• Precio por kg: $50

Envio de 5kg:
• Base: $500
• Servicio: $300
• Peso (5kg x $50): $250
• Total: $1,050

Uso en Tiendanube
Cuando un comprador ve opciones de envio:
• Tiendanube consulta al sistema
• Se calcula con la tarifa del seller
• El precio se muestra en el checkout`
    },
    {
      title: '11. FLUJO COMPLETO DE UN PEDIDO',
      content: `CICLO DE VIDA COMPLETO

Paso 1: Compra
Comprador paga en Tiendanube.

Paso 2: Webhook
Sistema recibe notificacion.
Pedido se registra en ecommerce_orders con estado "paid".

Paso 3: Visualizacion
Operador ve pedido en e-Commerce > Pedidos.

Paso 4: Crear Envio
Operador crea envio desde el pedido.
Se asigna tracking y sucursal origen.

Paso 5: Cuenta Corriente
Si seller tiene cta. cte., se registra cargo automatico.

Paso 6: Etiqueta
Operador imprime etiqueta y pega en paquete.

Paso 7: Operatoria
Envio entra en flujo normal:
• Incluir en hoja de ruta, o
• Asignar a ruta de reparto

Paso 8: Entrega
Chofer entrega y confirma.
Estado cambia a "entregado".

Paso 9: Liquidacion
Fin de mes: se genera liquidacion del seller.
Seller paga el total adeudado.

DIAGRAMA RESUMIDO

Compra en Tiendanube
        |
        v
Webhook --> ecommerce_orders
        |
        v
Operador crea envio
        |
        v
Cargo en cuenta corriente
        |
        v
Imprime etiqueta
        |
        v
Hoja de ruta o Ruta de reparto
        |
        v
Entrega completada
        |
        v
Liquidacion mensual`
    },
    {
      title: '12. CONSEJOS OPERATIVOS',
      content: `Configuracion Inicial
• Configurar sucursal de pickup correctamente antes de conectar
• Asignar tarifa antes de activar integracion
• Probar con un pedido de prueba

Operacion Diaria
• Revisar pedidos pagados cada manana
• Crear envios y despachar el mismo dia
• Mantener comunicacion con sellers

Gestion Financiera
• Generar liquidaciones semanales o quincenales
• No acumular saldos muy grandes
• Registrar pagos inmediatamente

Uso del Portal
• Capacitar sellers para usar el portal
• Reducen consultas telefonicas
• Mayor transparencia en la relacion

Mejores Practicas
• Mantener datos de sellers actualizados
• Revisar tarifas periodicamente
• Monitorear tiempos de entrega
• Resolver incidentes rapidamente`
    },
    {
      title: '13. PREGUNTAS FRECUENTES',
      content: `El pedido no llega al sistema
Posibles causas:
• Conexion OAuth vencida: reconectar Tiendanube
• Webhook no configurado: verificar en Tiendanube
• Error de sincronizacion: usar boton "Sincronizar"

El precio es incorrecto
Verificar:
• Tarifa asignada al seller
• Conceptos habilitados en la tarifa
• Precio por kg configurado

El seller no puede acceder al portal
Pasos:
1. Verificar que tiene usuario vinculado
2. Comprobar que el usuario esta activo
3. Verificar que tiene rol "seller"
4. Resetear contrasena si es necesario

Los envios no aparecen en Tiendanube
Causas posibles:
• Scopes de la app insuficientes
• Token de acceso expirado
• Error en la actualizacion de estado

Como desconectar Tiendanube
1. Editar seller
2. Borrar tokens de acceso
3. El seller debe revocar acceso desde Tiendanube

El saldo de cuenta corriente no cuadra
Acciones:
• Revisar historial de movimientos
• Verificar que todos los envios generaron cargo
• Crear ajuste manual si es necesario
• Documentar el ajuste con descripcion`
    }
  ]
};

export const generateEcommerceGuidePDF = (): void => {
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
      `Pagina ${pageCount}`,
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

  // Cover Page - Purple theme for e-Commerce
  doc.setFillColor(147, 51, 234); // Purple
  doc.rect(0, 0, pageWidth, 80, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('Geologistick', pageWidth / 2, 40, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('Modulo e-Commerce', pageWidth / 2, 55, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Guia de Usuario', pageWidth / 2, 110, { align: 'center' });
  
  doc.setFontSize(14);
  doc.text('para Administradores', pageWidth / 2, 125, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Manual completo del modulo de tiendas online', pageWidth / 2, 145, { align: 'center' });
  
  const date = new Date().toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  doc.text(`Generado: ${date}`, pageWidth / 2, 165, { align: 'center' });

  // Topics summary box
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, 180, contentWidth, 60, 'F');
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Contenido:', margin + 10, 195);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const topics = [
    'Gestion de Sellers y Tiendas Online',
    'Integracion con Tiendanube',
    'Relacion con Sucursales',
    'Cuenta Corriente y Liquidaciones',
    'Portal de Sellers'
  ];
  topics.forEach((topic, i) => {
    doc.text(`• ${topic}`, margin + 10, 208 + (i * 8));
  });

  // Table of Contents
  addPageNumber();
  doc.addPage();
  yPosition = margin;
  
  doc.setFillColor(147, 51, 234);
  doc.rect(0, 0, pageWidth, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Indice de Contenidos', margin, 17);
  
  yPosition = 40;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  ECOMMERCE_GUIDE_CONTENT.sections.forEach((section) => {
    checkNewPage(10);
    doc.text(section.title, margin, yPosition);
    yPosition += 10;
  });

  // Content Sections
  ECOMMERCE_GUIDE_CONTENT.sections.forEach((section) => {
    addPageNumber();
    doc.addPage();
    yPosition = margin;

    // Section Title with purple header
    doc.setFillColor(147, 51, 234);
    doc.rect(0, 0, pageWidth, 25, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
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

      // Check if it's a subsection header or diagram header
      const isHeader = !line.startsWith('•') && 
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
                       line.length < 50;
      
      const isDiagram = line.includes('-->') || line.includes('|') || line.startsWith('        ');

      if (isHeader && !isDiagram) {
        checkNewPage(14);
        yPosition += 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(147, 51, 234);
      } else if (isDiagram) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
      }

      // Word wrap
      const wrappedLines = doc.splitTextToSize(line, contentWidth);
      
      wrappedLines.forEach((wrappedLine: string) => {
        checkNewPage(7);
        doc.text(wrappedLine, margin, yPosition);
        yPosition += 6;
      });

      if (isHeader && !isDiagram) {
        yPosition += 2;
        doc.setTextColor(0, 0, 0);
      }
    });
  });

  // Add final page number
  addPageNumber();

  // Download
  doc.save('guia-ecommerce-geologistick.pdf');
};
