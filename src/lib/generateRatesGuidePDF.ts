import { jsPDF } from 'jspdf';
import { 
  loadLogoAsBase64, 
  addPageHeader, 
  addPageFooter, 
  drawCoverPage
} from './pdfHelpers';

const RATES_GUIDE_CONTENT = {
  title: 'Guia de Tarifas',
  subtitle: 'Configuracion de Precios - Geologistick',
  sections: [
    {
      title: '1. INTRODUCCION AL MODULO DE TARIFAS',
      content: `Que es una Tarifa
Una tarifa define como se calculan los precios de los envios. Cada tarifa tiene un precio base (flete) y puede incluir conceptos adicionales como retiro, entrega, seguro y embalaje.

Estructura de una Tarifa
• Precio Base (Flete): Monto inicial por el servicio
• Conceptos Basicos: Cargos que aplican automaticamente (ej: retiro, entrega)
• Conceptos Adicionales: Cargos opcionales que el operador puede agregar
• Configuracion de Peso/Volumen: Reglas para cobrar por kg o m3

Tipos de Tarifas Disponibles
El sistema soporta 5 tipos de calculo:
• Por Peso (Kg): El mas comun, precio segun peso del envio
• Por Distancia (Km): Precio base mas costo por kilometro
• Por Volumen (m3): Para paquetes grandes y livianos
• Por Zona: Precio fijo segun zona geografica
• Por Codigo Postal: Precio segun CP origen/destino`
    },
    {
      title: '2. TIPOS DE TARIFAS EN DETALLE',
      content: `TARIFA POR PESO (Kg)
Es el tipo mas utilizado. Hay dos metodos de calculo:

Metodo Simple
• Precio base hasta X kg
• Adicional por cada kg excedente
• Ejemplo: $500 base (hasta 2kg) + $50 por kg adicional

Metodo Escalonado (Rangos de Peso)
• Precio diferente segun el rango
• Permite tarifas mas precisas
• Ejemplo:
  - 0-5 kg: $800
  - 5.01-10 kg: $1,200
  - 10.01-20 kg: $1,800
  - Mas de 20 kg: $2,500

Cuando Usar Cada Metodo
• Simple: Envios pequenos con pesos similares
• Escalonado: Variedad de tamanos, mejor control de precios

---

TARIFA POR DISTANCIA (Km)
Ideal para servicios de mensajeria urbana.

Formula
Precio Total = Precio Base + (Distancia en Km x Precio por Km)

Configuracion
• precio_base: Monto minimo del servicio
• precio_por_km: Costo adicional por kilometro

Ejemplo
• Precio base: $300
• Precio por km: $25
• Distancia: 15 km
• Total: $300 + (15 x $25) = $675

---

TARIFA POR VOLUMEN (m3)
Para paquetes grandes pero livianos.

Formula
Precio Total = Precio Base + (Volumen en m3 x Precio por m3)

Cuando Usar
• Muebles y electrodomesticos grandes
• Paquetes con mucho aire (cajas grandes, poco peso)
• Cuando el volumen es mas limitante que el peso

Umbral de Volumen
El sistema puede cambiar automaticamente al calculo por volumen si alguna dimension del paquete supera el umbral configurado (por defecto 50 cm).

---

TARIFA POR ZONA
Precio fijo segun zona geografica.

Uso Tipico
• Zonas: Centro, Norte, Sur, Oeste
• Cada zona tiene precio definido
• No depende de peso ni distancia

Ventajas
• Simple de comunicar a clientes
• Precios predecibles
• Facil de administrar

---

TARIFA POR CODIGO POSTAL
Precio basado en CP de origen y destino.

Configuracion
• Definir rangos de codigos postales
• Asignar precio a cada rango o combinacion

Uso Tipico
• Empresas con muchas zonas
• Precios diferenciados por localidad`
    },
    {
      title: '3. CREAR UNA NUEVA TARIFA',
      content: `Paso 1: Acceder al Modulo
1. Ir a Administracion > Tarifas
2. Clic en "Nueva Tarifa"

Paso 2: Datos Basicos
• Nombre: Identificador descriptivo (ej: "Tarifa Standard", "E-Commerce Express")
• Tipo: Seleccionar tipo de calculo (peso, distancia, volumen, etc.)

Paso 3: Configurar Precio Base (Flete)
Segun el tipo seleccionado:

Para Peso Simple:
• Precio base: Monto hasta el peso incluido
• Peso incluido: Kg que cubre el precio base
• Adicional por kg: Costo de cada kg extra

Para Peso Escalonado:
1. Activar "Usar rangos de peso"
2. Agregar rangos:
   - Desde kg / Hasta kg / Precio
3. El sistema valida que no haya rangos superpuestos

Para Distancia:
• Precio base: Monto minimo
• Precio por km: Costo por kilometro

Para Volumen:
• Precio base: Monto minimo
• Precio por m3: Costo por metro cubico
• Umbral de volumen: Dimension que activa calculo volumetrico

Paso 4: Configurar Umbral de Volumen
• umbral_volumen_cm: Si alguna dimension supera este valor, se usa precio por volumen
• Por defecto: 50 cm

Paso 5: Multiplicar Flete por Bultos (Opcional)
• Activar si el flete debe cobrarse POR BULTO en lugar de por envio
• Ejemplo: Si el flete es $1,000 y hay 3 bultos:
  - Desactivado: Flete = $1,000 (cobro unico)
  - Activado: Flete = $3,000 (1,000 x 3 bultos)
• Util para empresas que cobran por cantidad de paquetes

Paso 6: Guardar Tarifa
• Clic en "Guardar"
• La tarifa queda disponible para asignar a sucursales

---

EJEMPLO PRACTICO: Tarifa de Encomiendas

Configuracion:
• Nombre: "Encomiendas Standard"
• Tipo: Por Peso
• Multiplicar por bultos: Si
• Rangos:
  - 0-2 kg: $800
  - 2.01-5 kg: $1,100
  - 5.01-10 kg: $1,500
  - 10.01-20 kg: $2,200
  - Mas de 20 kg: $3,000
• Umbral volumen: 60 cm

Resultado:
• Envio de 3 kg (1 bulto) = $1,100
• Envio de 12 kg (1 bulto) = $2,200
• Envio de 3 kg (2 bultos) = $2,200 (1,100 x 2)
• Envio de 8 kg pero con caja de 80 cm = Calculo por volumen`
    },
    {
      title: '4. CONCEPTOS ADICIONALES',
      content: `Que son los Conceptos
Son cargos adicionales al flete que se aplican segun el servicio o a solicitud del cliente.

Tipos de Conceptos

BASICOS (Aplican automaticamente)
• Retiro en Origen: Cargo por recoger el paquete
  - Aplica en servicios: Puerta a Sucursal, Puerta a Puerta
• Entrega en Destino: Cargo por entregar a domicilio
  - Aplica en servicios: Sucursal a Puerta, Puerta a Puerta

ADICIONALES (Opcionales)
• Seguro: Cobertura sobre valor declarado
• Embalaje: Caja, film, proteccion adicional
• Urgente: Entrega prioritaria
• Sabado: Entrega en fin de semana
• Manipuleo Especial: Objetos fragiles o pesados

Configurar un Concepto

1. Acceder a Tarifas > Conceptos
2. Crear o editar concepto
3. Definir:
   • Nombre: Descripcion clara
   • Tipo: Basico o Adicional
   • Precio Fijo: Monto constante (ej: $200)
   • Porcentaje: Sobre el flete (ej: 10%)
   • O ambos combinados

Ejemplo de Configuracion

Concepto "Retiro a Domicilio":
• Tipo: Basico
• Precio Fijo: $400
• Porcentaje: 0%
• Aplica cuando: Servicio incluye retiro

Concepto "Seguro":
• Tipo: Adicional
• Precio Fijo: $0
• Porcentaje: 2% del valor declarado
• Minimo: $150

---

HABILITAR CONCEPTOS POR SUCURSAL

No todas las sucursales ofrecen los mismos servicios.

Pasos:
1. Ir a tarifa > ver detalles
2. Clic en "Sucursales" del concepto
3. Seleccionar sucursales donde aplica
4. Guardar

Ejemplo:
• Concepto "Entrega Sabado" habilitado solo en:
  - Casa Central
  - Sucursal Zona Norte
• Las demas sucursales no muestran esta opcion`
    },
    {
      title: '5. ASIGNAR TARIFAS A SUCURSALES',
      content: `Por que Asignar Tarifas
Cada sucursal solo puede usar las tarifas que tiene asignadas. Esto permite:
• Precios diferentes por region
• Control sobre que tarifas usa cada punto
• Evitar errores de seleccion

Como Asignar

Metodo 1: Desde la Tarifa
1. Ir a Tarifas
2. Clic en icono de sucursales de la tarifa
3. Seleccionar sucursales
4. Guardar

Metodo 2: Desde la Sucursal
1. Ir a Sucursales > Editar
2. Seccion "Tarifas Habilitadas"
3. Seleccionar tarifas disponibles
4. Guardar

Tarifa por Defecto
Si una sucursal tiene UNA SOLA tarifa asignada:
• Se selecciona automaticamente al crear envio
• El selector de tarifa no aparece (innecesario)
• Agiliza la operacion

Si tiene MULTIPLES tarifas:
• El operador debe elegir cual usar
• Aparece el selector de tarifa en el formulario

---

EJEMPLO: Estructura de Tarifas por Sucursal

Casa Central (Buenos Aires):
• Tarifa Standard
• Tarifa Express
• Tarifa E-Commerce

Sucursal Cordoba:
• Tarifa Standard (misma que Casa Central)
• Tarifa Interior (precios regionales)

Sucursal Mendoza:
• Tarifa Interior (unica tarifa = autoseleccion)`
    },
    {
      title: '6. CALCULO DEL FLETE EN ENVIOS',
      content: `Formula Completa

El precio total de un envio se calcula asi:

PRECIO TOTAL = Flete Base + Seguro + Retiro + Entrega + Conceptos Adicionales

Donde:
• Flete Base: Segun tipo de tarifa (peso, distancia, etc.)
• Seguro: Si aplica, calculado sobre valor declarado
• Retiro: Si el servicio incluye retiro a domicilio
• Entrega: Si el servicio incluye entrega a domicilio
• Adicionales: Conceptos seleccionados por el operador

---

EJEMPLO PASO A PASO

Datos del Envio:
• Servicio: Puerta a Puerta
• Peso: 8 kg
• Valor declarado: $25,000
• Concepto adicional: Embalaje

Tarifa Configurada:
• Tipo: Por Peso (escalonado)
• Rangos:
  - 0-5 kg: $1,000
  - 5.01-10 kg: $1,400
  - 10.01-20 kg: $1,900
• Retiro: $400
• Entrega: $350
• Seguro: $100 base + 1% sobre valor declarado
• Embalaje: $250

Calculo:
1. Flete Base: $1,400 (rango 5.01-10 kg)
2. Seguro: $100 + (25,000 x 1%) = $100 + $250 = $350
3. Retiro: $400 (servicio Puerta a Puerta)
4. Entrega: $350 (servicio Puerta a Puerta)
5. Embalaje: $250 (concepto adicional)

TOTAL: $1,400 + $350 + $400 + $350 + $250 = $2,750

---

CUANDO APLICA RETIRO Y ENTREGA

Tipo de Servicio           | Retiro | Entrega
---------------------------|--------|--------
Sucursal a Sucursal        | No     | No
Sucursal a Puerta          | No     | Si
Puerta a Sucursal          | Si     | No
Puerta a Puerta            | Si     | Si`
    },
    {
      title: '7. CONFIGURACION DE SEGURO',
      content: `Formula del Seguro

Seguro = Base + ((Valor Declarado - Minimo) x Porcentaje)

Parametros Configurables:
• seguro_base: Monto fijo minimo (ej: $150)
• valor_minimo_declarado: Umbral desde donde cobra porcentaje
• porcentaje_excedente: Tasa sobre el valor excedente
• valor_maximo_asegurado: Tope de cobertura

---

EJEMPLO DE CALCULO

Configuracion del Seguro:
• Base: $150
• Valor minimo: $5,000
• Porcentaje: 1.5%
• Maximo asegurado: $500,000

Caso 1: Valor declarado $3,000
• Valor menor al minimo
• Seguro = $150 (solo la base)

Caso 2: Valor declarado $20,000
• Excedente: $20,000 - $5,000 = $15,000
• Porcentaje: $15,000 x 1.5% = $225
• Seguro = $150 + $225 = $375

Caso 3: Valor declarado $600,000
• Excede maximo asegurado
• Se calcula sobre $500,000 (tope)
• Excedente: $500,000 - $5,000 = $495,000
• Porcentaje: $495,000 x 1.5% = $7,425
• Seguro = $150 + $7,425 = $7,575

---

CONFIGURAR EL SEGURO

1. Ir a Tarifas > Configuracion de Seguro
2. Ajustar parametros:
   • Seguro base: Monto minimo obligatorio
   • Valor minimo declarado: Desde donde cobra %
   • Porcentaje excedente: Tasa del seguro
   • Valor maximo: Tope de cobertura
3. Guardar cambios

El seguro aplica globalmente a todas las tarifas del tenant.`
    },
    {
      title: '8. AJUSTES MASIVOS DE PRECIOS',
      content: `Que son los Ajustes Masivos
Permiten actualizar precios de multiples tarifas con un porcentaje de aumento (o disminucion).

Cuando Usar
• Inflacion: Actualizar todos los precios periodicamente
• Costos operativos: Aumentar por suba de combustible
• Promociones: Descuentos temporales (porcentaje negativo)

Como Realizar un Ajuste

1. Ir a Tarifas
2. Clic en "Ajuste Masivo"
3. Ingresar porcentaje (ej: 15 para +15%)
4. Seleccionar que afecta:
   • Precios base
   • Rangos de peso
   • Precio por m3
   • Conceptos adicionales
5. Vista previa de cambios
6. Confirmar ajuste

---

QUE AFECTA EL AJUSTE

Precios Base:
• precio_base de todas las tarifas
• precio_por_km (tarifas por distancia)
• precio_por_m3 (tarifas por volumen)

Rangos de Peso:
• Precio de cada rango escalonado
• No modifica los limites de kg

Conceptos:
• Precio fijo de cada concepto
• El porcentaje del concepto no cambia

---

HISTORIAL DE AJUSTES

Cada ajuste queda registrado con:
• Fecha y hora
• Porcentaje aplicado
• Usuario que lo realizo
• Opciones seleccionadas
• Tarifas y conceptos afectados

Consultar historial:
1. Ir a Tarifas
2. Clic en icono de historial
3. Ver lista de ajustes anteriores

El historial permite auditar cambios y entender la evolucion de precios.`
    },
    {
      title: '9. TARIFAS PARA E-COMMERCE',
      content: `Asignar Tarifa a Sellers
Los sellers de tiendas online necesitan una tarifa asignada para:
• Calcular precio al crear envio desde pedido
• Cotizar automaticamente en el checkout de Tiendanube

Pasos:
1. Ir a e-Commerce > Sellers
2. Editar el seller
3. Seleccionar "Tarifa Asignada"
4. Opcionalmente, seleccionar "Tarifa Express"
5. Guardar

---

TARIFA EXPRESS (Opcional)

Si el seller ofrece envio express:
• Asignar una segunda tarifa para entregas rapidas
• Mayor precio, menor tiempo de entrega
• Aparece como opcion adicional en el checkout

Configuracion de Tiempos:
• min_delivery_days: Dias minimos para entrega standard
• max_delivery_days: Dias maximos para entrega standard
• express_delivery_days: Dias para entrega express

---

COTIZACION AUTOMATICA EN TIENDANUBE

Cuando un comprador ingresa su direccion en el checkout:

1. Tiendanube consulta al sistema
2. Sistema identifica el seller por store_id
3. Busca la tarifa asignada al seller
4. Calcula precio con peso estimado del carrito
5. Devuelve opciones de envio:
   • Standard: Tarifa normal + dias estimados
   • Express: Tarifa express + dias express (si esta configurada)

El comprador ve las opciones y elige.

---

CONSIDERACIONES IMPORTANTES

• Asignar tarifa ANTES de conectar Tiendanube
• Si no hay tarifa, la cotizacion falla
• Los precios deben ser competitivos para conversion
• Revisar que los conceptos basicos esten bien configurados`
    },
    {
      title: '10. PREGUNTAS FRECUENTES',
      content: `POR QUE NO APARECE MI TARIFA AL CREAR ENVIO?

Posibles causas:
1. La tarifa no esta asignada a la sucursal de origen
   - Solucion: Asignar tarifa a la sucursal

2. La tarifa esta desactivada
   - Solucion: Activar la tarifa

3. Filtro de sucursal incorrecto
   - Solucion: Verificar sucursal seleccionada

---

COMO CAMBIO EL PRECIO DEL SEGURO?

El seguro es global para todo el tenant:
1. Ir a Tarifas > Configuracion de Seguro
2. Modificar los parametros
3. Guardar

Los cambios aplican a todos los envios nuevos.

---

PUEDO TENER DIFERENTES PRECIOS POR SUCURSAL?

Si, de dos formas:

Opcion 1: Tarifas diferentes
• Crear tarifa "Standard Capital"
• Crear tarifa "Standard Interior"
• Asignar cada una a las sucursales correspondientes

Opcion 2: Conceptos por sucursal
• Usar la misma tarifa base
• Habilitar conceptos diferentes por sucursal
• Ej: "Entrega Sabado" solo en algunas sucursales

---

COMO HAGO UN AUMENTO GENERAL DE PRECIOS?

1. Ir a Tarifas > Ajuste Masivo
2. Ingresar porcentaje (ej: 10)
3. Seleccionar que afecta
4. Ver preview
5. Confirmar

Todos los precios se actualizan automaticamente.

---

QUE PASA SI EL PAQUETE ES MUY GRANDE?

Si alguna dimension supera el umbral de volumen:
• El sistema cambia automaticamente a calculo por volumen
• Se usa precio_por_m3 en lugar de peso
• Esto evita perder dinero en paquetes grandes/livianos

---

PUEDO DESHACER UN AJUSTE MASIVO?

No hay funcion de deshacer automatico, pero:
• El historial muestra los valores anteriores
• Puedes aplicar un ajuste inverso
• Ej: Si subiste 15%, aplicar -13% (aprox)

Recomendacion: Hacer backup de precios antes de ajustes grandes.`
    }
  ]
};

const PRIMARY_COLOR: [number, number, number] = [245, 158, 11]; // Amber/Orange for Rates

export const generateRatesGuidePDF = async (): Promise<void> => {
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
    addPageHeader(doc, logoBase64, 'Guía de Tarifas - Geologistick', pageWidth, margin);
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
    'GUÍA DE TARIFAS',
    'Manual de Configuración de Precios',
    pageWidth,
    PRIMARY_COLOR
  );
  addFooter();

  // ===== TABLE OF CONTENTS =====
  doc.addPage();
  addHeader();
  yPosition = 35;

  doc.setFontSize(18);
  doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('CONTENIDO', margin, yPosition);
  yPosition += 15;

  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');

  RATES_GUIDE_CONTENT.sections.forEach((section, index) => {
    checkNewPage(8);
    doc.text(`${section.title}`, margin, yPosition);
    yPosition += 7;
  });

  addFooter();

  // ===== CONTENT PAGES =====
  RATES_GUIDE_CONTENT.sections.forEach((section) => {
    doc.addPage();
    addHeader();
    yPosition = 35;

    // Section title
    doc.setFontSize(16);
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.setFont('helvetica', 'bold');
    
    const titleLines = doc.splitTextToSize(section.title, contentWidth);
    titleLines.forEach((line: string) => {
      checkNewPage(10);
      doc.text(line, margin, yPosition);
      yPosition += 8;
    });
    
    yPosition += 5;

    // Decorative line under title
    doc.setDrawColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition - 3, margin + 60, yPosition - 3);
    yPosition += 5;

    // Section content
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'normal');

    const lines = section.content.split('\n');
    
    lines.forEach((line) => {
      // Handle headers within content
      if (line.match(/^[A-Z][A-Z\s]+[A-Z]$/) || line.match(/^[A-Z]{2,}/) && !line.startsWith('•')) {
        checkNewPage(15);
        yPosition += 4;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
        const headerLines = doc.splitTextToSize(line, contentWidth);
        headerLines.forEach((headerLine: string) => {
          doc.text(headerLine, margin, yPosition);
          yPosition += 6;
        });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        yPosition += 2;
      }
      // Handle separator lines
      else if (line.trim() === '---') {
        checkNewPage(10);
        yPosition += 3;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 6;
      }
      // Handle bullet points
      else if (line.trim().startsWith('•')) {
        checkNewPage(6);
        const bulletText = line.trim();
        const wrappedLines = doc.splitTextToSize(bulletText, contentWidth - 5);
        wrappedLines.forEach((wrappedLine: string, idx: number) => {
          checkNewPage(5);
          doc.text(wrappedLine, margin + (idx === 0 ? 0 : 5), yPosition);
          yPosition += 5;
        });
      }
      // Handle numbered items
      else if (line.trim().match(/^\d+\./)) {
        checkNewPage(6);
        const wrappedLines = doc.splitTextToSize(line.trim(), contentWidth - 5);
        wrappedLines.forEach((wrappedLine: string, idx: number) => {
          checkNewPage(5);
          doc.text(wrappedLine, margin + (idx === 0 ? 0 : 5), yPosition);
          yPosition += 5;
        });
      }
      // Handle table-like content
      else if (line.includes('|')) {
        checkNewPage(6);
        doc.setFont('courier', 'normal');
        doc.setFontSize(9);
        doc.text(line.trim(), margin, yPosition);
        yPosition += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
      }
      // Handle indented content (examples, sub-items)
      else if (line.startsWith('   ') || line.startsWith('  -')) {
        checkNewPage(5);
        doc.setTextColor(80, 80, 80);
        const wrappedLines = doc.splitTextToSize(line.trim(), contentWidth - 10);
        wrappedLines.forEach((wrappedLine: string) => {
          checkNewPage(5);
          doc.text(wrappedLine, margin + 8, yPosition);
          yPosition += 5;
        });
        doc.setTextColor(50, 50, 50);
      }
      // Handle empty lines
      else if (line.trim() === '') {
        yPosition += 3;
      }
      // Regular text
      else {
        checkNewPage(5);
        const wrappedLines = doc.splitTextToSize(line, contentWidth);
        wrappedLines.forEach((wrappedLine: string) => {
          checkNewPage(5);
          doc.text(wrappedLine, margin, yPosition);
          yPosition += 5;
        });
      }
    });

    addFooter();
  });

  // Save the PDF
  doc.save('Guia_de_Tarifas_Geologistick.pdf');
};
