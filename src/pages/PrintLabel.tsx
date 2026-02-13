import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, 
  Printer, 
  Building2, 
  Home, 
  Package,
  Phone,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

type LabelSize = 'compact' | 'standard' | 'large';

const LABEL_SIZES = {
  compact: {
    name: "Compacta (10×15 cm)",
    width: "10cm",
    height: "15cm",
    qrSize: 120,
  },
  standard: {
    name: "Estándar (15×10 cm)",
    width: "15cm",
    height: "10cm",
    qrSize: 150,
  },
  large: {
    name: "Grande (20×10 cm)",
    width: "20cm",
    height: "10cm",
    qrSize: 180,
  },
};

const TIPO_SERVICIO_CONFIG = {
  sucursal_sucursal: { 
    label: 'SUCURSAL A SUCURSAL', 
    icon: '[S→S]',
    bgColor: '#000000',
    textColor: '#ffffff',
  },
  sucursal_puerta: { 
    label: 'ENTREGA A DOMICILIO', 
    icon: '[S→D]',
    bgColor: '#000000',
    textColor: '#ffffff',
  },
  puerta_sucursal: { 
    label: 'RETIRO + SUCURSAL', 
    icon: '[D→S]',
    bgColor: '#000000',
    textColor: '#ffffff',
  },
  puerta_puerta: { 
    label: 'PUERTA A PUERTA', 
    icon: '[D→D]',
    bgColor: '#000000',
    textColor: '#ffffff',
  },
};

const TIPO_PAGO_LABELS: Record<string, string> = {
  contado: 'CONTADO',
  destino: 'PAGO EN DESTINO',
  cuenta_corriente: 'CTA. CTE.',
};

interface Envio {
  id: string;
  tracking_number: string;
  cantidad_bultos: number;
  peso_kg: number | null;
  precio_total: number;
  tipo_pago: string | null;
  tipo_servicio_detalle: string | null;
  descripcion: string | null;
  notas: string | null;
  direccion_entrega: string | null;
  ciudad_entrega: string | null;
  cp_entrega: string | null;
  direccion_retiro: string | null;
  ciudad_retiro: string | null;
  cp_retiro: string | null;
  dni_remitente: string | null;
  dni_destinatario: string | null;
  whatsapp_destinatario: string | null;
  created_at: string;
  tenant_id: string | null;
  nombre_remitente: string | null;
  nombre_destinatario: string | null;
  es_terciarizado: boolean | null;
  empresa_terciarizada: string | null;
  tracking_externo: string | null;
  codigo_cliente_externo: string | null;
  codigo_orden_externo: string | null;
  provincia: string | null;
  remitente: {
    nombre: string;
    apellido: string | null;
    telefono: string;
    direccion: string;
  } | null;
  destinatario: {
    nombre: string;
    apellido: string | null;
    telefono: string;
    direccion: string;
  } | null;
  sucursal_origen: {
    codigo: string | null;
    nombre: string;
    telefono: string | null;
    direccion: string;
    ciudad: string | null;
  } | null;
  sucursal_destino: {
    codigo: string | null;
    nombre: string;
    telefono: string | null;
    direccion: string;
    ciudad: string | null;
  } | null;
  logoUrl?: string | null;
}

// Helper function to get QR code URL from external API
const getQRCodeUrl = (data: string, size: number) => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(data)}&format=png&margin=3&ecc=M`;
};

// Generate complete HTML document for printing
const generateLabelHTML = (
  envio: Envio,
  labelSize: LabelSize,
  tipoConfig: typeof TIPO_SERVICIO_CONFIG[keyof typeof TIPO_SERVICIO_CONFIG],
  deliveryInfo: { type: string; direccion?: string; ciudad?: string | null; cp?: string | null; nombre?: string } | null,
  logoUrl?: string | null
): string => {
  const size = LABEL_SIZES[labelSize];
  const bultos = envio.cantidad_bultos || 1;
  const baseUrl = window.location.origin;
  const destCiudad = envio.ciudad_entrega || envio.sucursal_destino?.ciudad || '';
  const letraZona = destCiudad ? destCiudad.charAt(0).toUpperCase() : '';
  
  const labelsHTML = Array.from({ length: bultos }, (_, i) => {
    const bultoNum = i + 1;
    const trackingCode = `${envio.tracking_number}-${String(bultoNum).padStart(2, '0')}`;
    const qrUrl = getQRCodeUrl(`${baseUrl}/tracking?q=${trackingCode}`, size.qrSize);
    const docCliente = envio.codigo_cliente_externo || envio.dni_remitente || '-';
    const operativa = envio.sucursal_destino?.codigo || '-';
    const pesoStr = envio.peso_kg ? envio.peso_kg.toFixed(2).replace('.', ',') : '0,00';
    const destinatarioNombre = envio.destinatario 
      ? `${envio.destinatario.nombre} ${envio.destinatario.apellido || ''}`.trim()
      : (envio.nombre_destinatario || 'Sin destinatario');
    const destinatarioTel = envio.destinatario?.telefono || envio.whatsapp_destinatario || '';
    const remitenteNombre = envio.remitente 
      ? `${envio.remitente.nombre} ${envio.remitente.apellido || ''}`.trim()
      : (envio.nombre_remitente || 'Sin remitente');
    const remitenteTel = envio.remitente?.telefono || '';
    const direccionEntrega = deliveryInfo?.direccion || 'Sin dirección';
    const cpEntrega = deliveryInfo?.cp || envio.cp_entrega || '';
    const ciudadEntrega = deliveryInfo?.ciudad || envio.ciudad_entrega || '';
    const provinciaEntrega = envio.provincia || '';
    const observaciones = envio.descripcion || envio.notas || '';
    const tipoPagoLabel = TIPO_PAGO_LABELS[envio.tipo_pago || 'contado'];
    const precioStr = `$${envio.precio_total.toLocaleString('es-AR')}`;

    return `
      <div class="label">
        <table class="label-table">
          <!-- Fila 1: Header con logo y tracking -->
          <tr>
            <td class="logo-cell" rowspan="2">
              ${logoUrl ? `<img src="${logoUrl}" class="tenant-logo" alt="" />` : '<div class="logo-placeholder"></div>'}
            </td>
            <td class="tracking-cell" colspan="3">
              <div class="tracking-number">${envio.tracking_number}</div>
              <div class="tracking-code">${trackingCode}</div>
            </td>
          </tr>
          <!-- Fila 2: Fecha -->
          <tr>
            <td class="date-cell" colspan="3">
              ${format(new Date(envio.created_at), 'dd/MM/yyyy', { locale: es })}
            </td>
          </tr>
          <!-- Fila 3: Grilla 4 columnas -->
          <tr>
            <td class="header-cell">DOC. CLIENTE</td>
            <td class="header-cell">BULTO</td>
            <td class="header-cell">OPERATIVA</td>
            <td class="header-cell">PESO</td>
          </tr>
          <tr>
            <td class="data-cell">${docCliente}</td>
            <td class="data-cell">${bultoNum} / ${bultos}</td>
            <td class="data-cell">${operativa}</td>
            <td class="data-cell">${pesoStr} kg</td>
          </tr>
          <!-- Fila 4: Sucursal destino -->
          <tr>
            <td class="header-cell" colspan="2">SUCURSAL DESTINO</td>
            <td class="dest-code-cell" colspan="1">
              <span class="dest-code">${envio.sucursal_destino?.codigo || '-'}</span>
            </td>
            <td class="zona-cell">
              <span class="zona-letter">${letraZona}</span>
            </td>
          </tr>
          <tr>
            <td class="data-cell dest-name-cell" colspan="4">
              ${envio.sucursal_destino?.nombre || '-'}
            </td>
          </tr>
          <!-- Fila 5: Tipo de servicio -->
          <tr>
            <td class="service-cell" colspan="4">
              ★ ${tipoConfig.label} ★
            </td>
          </tr>
          <!-- Fila 6: Destinatario -->
          <tr>
            <td class="header-cell header-center" colspan="4">DESTINATARIO</td>
          </tr>
          <tr>
            <td class="data-cell dest-data" colspan="4">
              <div class="dest-line"><strong>${destinatarioNombre}</strong>${envio.dni_destinatario ? ` - DNI: ${envio.dni_destinatario}` : ''}</div>
              <div class="dest-line">${direccionEntrega}${cpEntrega ? ` (${cpEntrega})` : ''}</div>
              <div class="dest-line">${ciudadEntrega}${provinciaEntrega ? ` - ${provinciaEntrega}` : ''}${destinatarioTel ? ` - Tel: ${destinatarioTel}` : ''}</div>
            </td>
          </tr>
          <!-- Fila 7: Observaciones + QR -->
          <tr>
            <td class="header-cell" colspan="4">OBSERVACIONES</td>
          </tr>
          <tr>
            <td class="obs-qr-cell" colspan="4">
              <div class="obs-qr-row">
                <div class="obs-content">
                  <div class="obs-text">${observaciones || '-'}</div>
                  <div class="obs-payment">
                    <span class="payment-badge">${tipoPagoLabel}</span>
                    <span class="price-tag">${precioStr}</span>
                  </div>
                </div>
                <div class="qr-container">
                  <img src="${qrUrl}" alt="QR" class="qr-image" />
                </div>
              </div>
            </td>
          </tr>
          <!-- Fila 8: Sucursal origen -->
          <tr>
            <td class="header-cell">SUCURSAL ORIGEN</td>
            <td class="data-cell" colspan="3">
              <strong>${envio.sucursal_origen?.codigo || '-'}</strong> - ${envio.sucursal_origen?.nombre || 'Sin sucursal'}
            </td>
          </tr>
          <!-- Fila 9: Remitente -->
          <tr>
            <td class="header-cell header-center" colspan="4">REMITENTE</td>
          </tr>
          <tr>
            <td class="data-cell remitente-data" colspan="4">
              ${remitenteNombre}${remitenteTel ? ` - Tel: ${remitenteTel}` : ''}
            </td>
          </tr>
        </table>
      </div>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Etiquetas - ${envio.tracking_number}</title>
  <style>
    *
    {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @page {
      size: auto;
      margin: 5mm;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      background: white;
      margin: 0;
      padding: 0;
    }
    
    .label {
      width: ${size.width};
      height: ${size.height};
      max-height: ${size.height};
      background: white;
      box-sizing: border-box;
      overflow: hidden;
      display: inline-block;
      vertical-align: top;
      page-break-inside: avoid;
      margin: 0 2mm 2mm 0;
    }
    
    .label-table {
      width: 100%;
      border-collapse: collapse;
      border: 2px solid #000;
      table-layout: fixed;
    }
    
    .label-table td {
      border: 1px solid #000;
      vertical-align: middle;
    }
    
    .header-cell {
      background: #000;
      color: #fff;
      font-size: ${labelSize === 'compact' ? '7px' : '8px'};
      font-weight: bold;
      padding: 1mm 2mm;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    .header-center {
      text-align: center;
    }
    
    .data-cell {
      background: #fff;
      color: #000;
      font-size: ${labelSize === 'compact' ? '10px' : '12px'};
      font-weight: bold;
      padding: 1mm 2mm;
    }
    
    .logo-cell {
      width: 30%;
      padding: 2mm;
      text-align: center;
      vertical-align: middle;
    }
    
    .tenant-logo {
      max-width: 25mm;
      max-height: 15mm;
      object-fit: contain;
    }
    
    .logo-placeholder {
      width: 25mm;
      height: 10mm;
    }
    
    .tracking-cell {
      text-align: right;
      padding: 2mm 3mm;
      background: #fff;
    }
    
    .tracking-number {
      font-family: monospace;
      font-size: ${labelSize === 'compact' ? '14px' : '18px'};
      font-weight: bold;
      letter-spacing: 1px;
      color: #000;
    }
    
    .tracking-code {
      font-family: monospace;
      font-size: ${labelSize === 'compact' ? '9px' : '10px'};
      color: #555;
      margin-top: 1mm;
    }
    
    .date-cell {
      text-align: right;
      padding: 1mm 3mm;
      font-size: ${labelSize === 'compact' ? '7px' : '8px'};
      font-weight: 600;
      color: #000;
      background: #fff;
    }
    
    .dest-code-cell {
      text-align: center;
      padding: 1mm 2mm;
      background: #fff;
    }
    
    .dest-code {
      font-size: ${labelSize === 'compact' ? '16px' : '20px'};
      font-weight: 900;
      color: #000;
    }
    
    .zona-cell {
      text-align: center;
      padding: 1mm;
      width: 12mm;
    }
    
    .zona-letter {
      display: inline-block;
      background: #000;
      color: #fff;
      font-size: ${labelSize === 'compact' ? '16px' : '20px'};
      font-weight: 900;
      padding: 1mm 2mm;
      min-width: 8mm;
      text-align: center;
    }
    
    .dest-name-cell {
      font-size: ${labelSize === 'compact' ? '9px' : '10px'};
      font-weight: 600;
    }
    
    .service-cell {
      text-align: center;
      font-size: ${labelSize === 'compact' ? '10px' : '12px'};
      font-weight: bold;
      padding: 2mm;
      background: #fff;
      color: #000;
      letter-spacing: 1px;
    }
    
    .dest-data {
      padding: 2mm 3mm;
    }
    
    .dest-line {
      font-size: ${labelSize === 'compact' ? '9px' : '10px'};
      line-height: 1.5;
      color: #000;
    }
    
    .dest-line strong {
      font-size: ${labelSize === 'compact' ? '11px' : '13px'};
    }
    
    .obs-qr-cell {
      padding: 0;
      background: #fff;
    }
    
    .obs-qr-row {
      display: flex;
      align-items: stretch;
    }
    
    .obs-content {
      flex: 1;
      padding: 2mm 3mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    
    .obs-text {
      font-size: ${labelSize === 'compact' ? '8px' : '9px'};
      color: #000;
      line-height: 1.4;
      margin-bottom: 2mm;
    }
    
    .obs-payment {
      display: flex;
      align-items: center;
      gap: 3mm;
    }
    
    .payment-badge {
      font-size: ${labelSize === 'compact' ? '7px' : '8px'};
      font-weight: bold;
      padding: 1mm 2mm;
      border: 1.5px solid #000;
      color: #000;
    }
    
    .price-tag {
      font-size: ${labelSize === 'compact' ? '14px' : '16px'};
      font-weight: 900;
      color: #000;
    }
    
    .qr-container {
      border-left: 1px solid #000;
      padding: 2mm;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
    }
    
    .qr-image {
      width: ${labelSize === 'compact' ? '80px' : labelSize === 'standard' ? '100px' : '120px'};
      height: ${labelSize === 'compact' ? '80px' : labelSize === 'standard' ? '100px' : '120px'};
      display: block;
    }
    
    .remitente-data {
      font-size: ${labelSize === 'compact' ? '9px' : '10px'};
      text-align: center;
    }
    
    @media print {
      html, body {
        width: 100%;
        height: auto;
        margin: 0;
        padding: 0;
      }
      
      .label {
        width: ${size.width};
        height: ${size.height};
        max-height: ${size.height};
        overflow: hidden;
        display: inline-block;
        vertical-align: top;
        margin: 0 2mm 2mm 0;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  ${labelsHTML}
</body>
</html>`;
};

export default function PrintLabel() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [labelSize, setLabelSize] = useState<LabelSize>('standard');
  const [isPrinting, setIsPrinting] = useState(false);
  const envioId = searchParams.get('id');

  const { data: envio, isLoading, error } = useQuery({
    queryKey: ['envio-print', envioId],
    queryFn: async () => {
      if (!envioId) throw new Error('ID de envío requerido');
      
      const { data, error } = await supabase
        .from('envios')
        .select(`
          *,
          remitente:clientes!envios_remitente_id_fkey(nombre, apellido, telefono, direccion),
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, telefono, direccion),
          sucursal_origen:sucursales!envios_sucursal_origen_id_fkey(codigo, nombre, telefono, direccion, ciudad),
          sucursal_destino:sucursales!envios_sucursal_destino_id_fkey(codigo, nombre, telefono, direccion, ciudad)
        `)
        .eq('id', envioId)
        .single();
      
      if (error) throw error;
      
      // Fetch tenant branding for logo
      let logoUrl: string | null = null;
      if (data.tenant_id) {
        const { data: branding } = await supabase
          .from('tenant_branding')
          .select('logo_light')
          .eq('tenant_id', data.tenant_id)
          .single();
        logoUrl = branding?.logo_light || null;
      }
      
      return { ...data, logoUrl } as Envio;
    },
    enabled: !!envioId,
  });

  const handlePrint = () => {
    if (!envio) return;
    
    setIsPrinting(true);
    
    const tipoServicio = envio.tipo_servicio_detalle || 'sucursal_sucursal';
    const tipoConfig = TIPO_SERVICIO_CONFIG[tipoServicio as keyof typeof TIPO_SERVICIO_CONFIG] 
      || TIPO_SERVICIO_CONFIG.sucursal_sucursal;

    const getDeliveryAddress = () => {
      if (['sucursal_puerta', 'puerta_puerta', 'domicilio_domicilio'].includes(tipoServicio)) {
        if (envio.direccion_entrega) {
          return {
            type: 'domicilio',
            direccion: envio.direccion_entrega,
            ciudad: envio.ciudad_entrega,
            cp: envio.cp_entrega,
          };
        }
        if (envio.destinatario) {
          return {
            type: 'domicilio',
            direccion: envio.destinatario.direccion,
            ciudad: null,
            cp: null,
          };
        }
      }
      if (envio.sucursal_destino) {
        return {
          type: 'sucursal',
          nombre: envio.sucursal_destino.nombre,
          direccion: envio.sucursal_destino.direccion,
          ciudad: envio.sucursal_destino.ciudad,
        };
      }
      return null;
    };

    const deliveryInfo = getDeliveryAddress();
    const labelHTML = generateLabelHTML(envio, labelSize, tipoConfig, deliveryInfo, envio.logoUrl);

    // Crear iframe oculto para impresion mas confiable
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc || !iframe.contentWindow) {
      toast.error("Error al preparar la impresión");
      setIsPrinting(false);
      document.body.removeChild(iframe);
      return;
    }

    iframeDoc.open();
    iframeDoc.write(labelHTML);
    iframeDoc.close();

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          setIsPrinting(false);
        }, 1000);
      }, 500);
    };

    // Fallback de seguridad
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      setIsPrinting(false);
    }, 10000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <Package className="h-12 w-12 animate-pulse text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando etiqueta...</p>
        </div>
      </div>
    );
  }

  if (error || !envio) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <p className="text-destructive">Error: {error?.message || 'Envío no encontrado'}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
      </div>
    );
  }

  const tipoServicio = envio.tipo_servicio_detalle || 'sucursal_sucursal';
  const tipoConfig = TIPO_SERVICIO_CONFIG[tipoServicio as keyof typeof TIPO_SERVICIO_CONFIG] 
    || TIPO_SERVICIO_CONFIG.sucursal_sucursal;
  
  const bultos = envio.cantidad_bultos || 1;
  const labels = Array.from({ length: bultos }, (_, i) => i + 1);

  const getDeliveryAddress = () => {
    if (['sucursal_puerta', 'puerta_puerta', 'domicilio_domicilio'].includes(tipoServicio)) {
      if (envio.direccion_entrega) {
        return {
          type: 'domicilio',
          direccion: envio.direccion_entrega,
          ciudad: envio.ciudad_entrega,
          cp: envio.cp_entrega,
        };
      }
      if (envio.destinatario) {
        return {
          type: 'domicilio',
          direccion: envio.destinatario.direccion,
          ciudad: null,
          cp: null,
        };
      }
    }
    if (envio.sucursal_destino) {
      return {
        type: 'sucursal',
        nombre: envio.sucursal_destino.nombre,
        direccion: envio.sucursal_destino.direccion,
        ciudad: envio.sucursal_destino.ciudad,
      };
    }
    return null;
  };

  const deliveryInfo = getDeliveryAddress();
  const destCiudad = envio.ciudad_entrega || envio.sucursal_destino?.ciudad || '';
  const letraZona = destCiudad ? destCiudad.charAt(0).toUpperCase() : '';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 flex-wrap gap-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Imprimir Etiquetas</h1>
            <p className="text-muted-foreground">
              {envio.tracking_number} • {bultos} {bultos === 1 ? 'bulto' : 'bultos'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Tamaño:</span>
            <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSize)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LABEL_SIZES).map(([key, size]) => (
                  <SelectItem key={key} value={key}>{size.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handlePrint} className="gradient-primary" disabled={isPrinting}>
            {isPrinting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Printer className="h-4 w-4 mr-2" />
            )}
            Imprimir
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="p-4">
        <p className="text-sm text-muted-foreground mb-4">
          Vista previa de las etiquetas. Al imprimir se abrirá una ventana nueva con las etiquetas optimizadas.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {labels.map((bultoNum) => {
            const trackingCode = `${envio.tracking_number}-${String(bultoNum).padStart(2, '0')}`;
            const docCliente = envio.codigo_cliente_externo || envio.dni_remitente || '-';
            const operativa = envio.sucursal_destino?.codigo || '-';
            const pesoStr = envio.peso_kg ? envio.peso_kg.toFixed(2).replace('.', ',') : '0,00';
            const destinatarioNombre = envio.destinatario 
              ? `${envio.destinatario.nombre} ${envio.destinatario.apellido || ''}`.trim()
              : (envio.nombre_destinatario || 'Sin destinatario');
            const destinatarioTel = envio.destinatario?.telefono || envio.whatsapp_destinatario || '';
            const remitenteNombre = envio.remitente 
              ? `${envio.remitente.nombre} ${envio.remitente.apellido || ''}`.trim()
              : (envio.nombre_remitente || 'Sin remitente');
            const remitenteTel = envio.remitente?.telefono || '';
            const direccionEntrega = deliveryInfo?.direccion || 'Sin dirección';
            const cpEntrega = deliveryInfo?.cp || envio.cp_entrega || '';
            const ciudadEntrega = deliveryInfo?.ciudad || envio.ciudad_entrega || '';
            const provinciaEntrega = envio.provincia || '';
            const observaciones = envio.descripcion || envio.notas || '';
            const tipoPagoLabel = TIPO_PAGO_LABELS[envio.tipo_pago || 'contado'];

            return (
              <div key={bultoNum} className="bg-white border-2 border-black overflow-hidden">
                {/* Fila 1: Header - Logo + Tracking */}
                <div className="grid grid-cols-[30%_1fr] border-b border-black">
                  <div className="border-r border-black p-2 flex items-center justify-center">
                    {envio.logoUrl ? (
                      <img src={envio.logoUrl} alt="" className="max-w-[80px] max-h-[40px] object-contain" />
                    ) : (
                      <div className="w-[60px] h-[30px]" />
                    )}
                  </div>
                  <div className="p-2 text-right">
                    <p className="font-mono font-bold text-lg tracking-wider">{envio.tracking_number}</p>
                    <p className="font-mono text-[10px] text-gray-500">{trackingCode}</p>
                    <p className="text-[10px] font-semibold mt-0.5">
                      {format(new Date(envio.created_at), 'dd/MM/yyyy', { locale: es })}
                    </p>
                  </div>
                </div>

                {/* Fila 2: Grilla 4 columnas */}
                <div className="grid grid-cols-4">
                  <div className="bg-black text-white text-[7px] font-bold uppercase px-2 py-0.5 border-r border-black">DOC. CLIENTE</div>
                  <div className="bg-black text-white text-[7px] font-bold uppercase px-2 py-0.5 border-r border-black">BULTO</div>
                  <div className="bg-black text-white text-[7px] font-bold uppercase px-2 py-0.5 border-r border-black">OPERATIVA</div>
                  <div className="bg-black text-white text-[7px] font-bold uppercase px-2 py-0.5">PESO</div>
                </div>
                <div className="grid grid-cols-4 border-b border-black">
                  <div className="text-xs font-bold px-2 py-1 border-r border-black">{docCliente}</div>
                  <div className="text-xs font-bold px-2 py-1 border-r border-black">{bultoNum} / {bultos}</div>
                  <div className="text-xs font-bold px-2 py-1 border-r border-black">{operativa}</div>
                  <div className="text-xs font-bold px-2 py-1">{pesoStr} kg</div>
                </div>

                {/* Fila 3: Sucursal destino */}
                <div className="grid grid-cols-[auto_1fr_auto] border-b border-black">
                  <div className="bg-black text-white text-[7px] font-bold uppercase px-2 py-1 border-r border-black flex items-center">
                    SUCURSAL<br/>DESTINO
                  </div>
                  <div className="px-2 py-1 flex items-center">
                    <span className="font-black text-xl">{envio.sucursal_destino?.codigo || '-'}</span>
                    <span className="text-[9px] font-semibold ml-2">{envio.sucursal_destino?.nombre || ''}</span>
                  </div>
                  <div className="flex items-center justify-center px-2">
                    {letraZona && (
                      <span className="bg-black text-white font-black text-xl px-2 py-0.5 min-w-[28px] text-center">
                        {letraZona}
                      </span>
                    )}
                  </div>
                </div>

                {/* Fila 4: Tipo servicio */}
                <div className="text-center font-bold text-xs tracking-wide py-1.5 border-b border-black">
                  ★ {tipoConfig.label} ★
                </div>

                {/* Fila 5: Destinatario */}
                <div className="bg-black text-white text-[8px] font-bold uppercase text-center py-0.5">DESTINATARIO</div>
                <div className="px-2 py-1.5 border-b border-black">
                  <p className="text-sm font-bold">{destinatarioNombre}{envio.dni_destinatario ? ` - DNI: ${envio.dni_destinatario}` : ''}</p>
                  <p className="text-[10px]">{direccionEntrega}{cpEntrega ? ` (${cpEntrega})` : ''}</p>
                  <p className="text-[10px]">{ciudadEntrega}{provinciaEntrega ? ` - ${provinciaEntrega}` : ''}{destinatarioTel ? ` - Tel: ${destinatarioTel}` : ''}</p>
                </div>

                {/* Fila 6: Observaciones + QR */}
                <div className="bg-black text-white text-[7px] font-bold uppercase px-2 py-0.5">OBSERVACIONES</div>
                <div className="flex border-b border-black">
                  <div className="flex-1 px-2 py-1.5 flex flex-col justify-between">
                    <p className="text-[9px] leading-tight">{observaciones || '-'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[8px] font-bold px-1 py-0.5 border border-black">{tipoPagoLabel}</span>
                      <span className="font-black text-base">${envio.precio_total.toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                  <div className="border-l border-black p-1.5 flex items-center justify-center">
                    <img 
                      src={getQRCodeUrl(`${window.location.origin}/tracking?q=${trackingCode}`, 80)}
                      alt="QR Code"
                      className="w-20 h-20"
                    />
                  </div>
                </div>

                {/* Fila 7: Sucursal origen */}
                <div className="grid grid-cols-[auto_1fr] border-b border-black">
                  <div className="bg-black text-white text-[7px] font-bold uppercase px-2 py-1 border-r border-black">SUCURSAL ORIGEN</div>
                  <div className="px-2 py-1 text-xs font-bold">
                    <strong>{envio.sucursal_origen?.codigo || '-'}</strong> - {envio.sucursal_origen?.nombre || 'Sin sucursal'}
                  </div>
                </div>

                {/* Fila 8: Remitente */}
                <div className="bg-black text-white text-[8px] font-bold uppercase text-center py-0.5">REMITENTE</div>
                <div className="text-center text-[10px] font-semibold px-2 py-1">
                  {remitenteNombre}{remitenteTel ? ` - Tel: ${remitenteTel}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
