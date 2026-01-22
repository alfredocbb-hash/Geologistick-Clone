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
    qrSize: 80,
  },
  standard: {
    name: "Estándar (15×10 cm)",
    width: "15cm",
    height: "10cm",
    qrSize: 100,
  },
  large: {
    name: "Grande (20×10 cm)",
    width: "20cm",
    height: "10cm",
    qrSize: 120,
  },
};

const TIPO_SERVICIO_CONFIG = {
  sucursal_sucursal: { 
    label: 'SUCURSAL A SUCURSAL', 
    icon: '🏢→🏢',
    bgColor: '#3b82f6',
    textColor: '#ffffff',
  },
  sucursal_puerta: { 
    label: 'ENTREGA A DOMICILIO', 
    icon: '🏢→🏠',
    bgColor: '#16a34a',
    textColor: '#ffffff',
  },
  puerta_sucursal: { 
    label: 'RETIRO + SUCURSAL', 
    icon: '🏠→🏢',
    bgColor: '#f59e0b',
    textColor: '#ffffff',
  },
  puerta_puerta: { 
    label: 'PUERTA A PUERTA', 
    icon: '🏠→🏠',
    bgColor: '#8b5cf6',
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
  deliveryInfo: { type: string; direccion?: string; ciudad?: string | null; cp?: string | null; nombre?: string } | null
): string => {
  const size = LABEL_SIZES[labelSize];
  const bultos = envio.cantidad_bultos || 1;
  const baseUrl = window.location.origin;
  
  const labelsHTML = Array.from({ length: bultos }, (_, i) => {
    const bultoNum = i + 1;
    const trackingCode = `${envio.tracking_number}-${String(bultoNum).padStart(2, '0')}`;
    const qrUrl = getQRCodeUrl(`${baseUrl}/tracking?q=${trackingCode}`, size.qrSize);
    
    return `
      <div class="label">
        <!-- Header -->
        <div class="header">
          <div class="origin-branch">
            <span class="icon">🏢</span>
            <div>
              <div class="branch-name">${envio.sucursal_origen?.codigo || 'XXX'} - ${envio.sucursal_origen?.nombre || 'Sin sucursal'}</div>
              ${envio.sucursal_origen?.telefono ? `<div class="branch-phone">Tel: ${envio.sucursal_origen.telefono}</div>` : ''}
            </div>
          </div>
          <div class="date">${format(new Date(envio.created_at), 'dd/MM/yyyy', { locale: es })}</div>
        </div>

        <!-- Tracking -->
        <div class="tracking-section">
          <div class="tracking-number">${envio.tracking_number}</div>
          <div class="bulto-badge">📦 BULTO ${bultoNum} / ${bultos}</div>
          <div class="tracking-code">${trackingCode}</div>
        </div>

        <!-- QR Code -->
        <div class="qr-section">
          <div class="qr-container">
            <img src="${qrUrl}" alt="QR Code" class="qr-image" />
          </div>
        </div>

        <!-- Service Type Badge -->
        <div class="service-badge" style="background-color: ${tipoConfig.bgColor}; color: ${tipoConfig.textColor};">
          <span>${tipoConfig.icon}</span>
          <span class="service-label">${tipoConfig.label}</span>
        </div>

        <div class="divider"></div>

        <!-- Recipient -->
        <div class="section">
          <div class="section-title">DESTINATARIO</div>
          <div class="recipient-name">
            ${envio.destinatario 
              ? `${envio.destinatario.nombre} ${envio.destinatario.apellido || ''}`
              : 'Sin destinatario'}
          </div>
          ${envio.dni_destinatario ? `<div class="recipient-dni">DNI: ${envio.dni_destinatario}</div>` : ''}
          ${envio.destinatario?.telefono ? `<div class="recipient-phone">📞 ${envio.destinatario.telefono}</div>` : ''}
        </div>

        <div class="divider"></div>

        <!-- Delivery Address -->
        <div class="section">
          <div class="section-title">${deliveryInfo?.type === 'sucursal' ? 'RETIRA EN SUCURSAL' : 'ENTREGAR EN'}</div>
          ${deliveryInfo?.type === 'sucursal' ? `
            <div class="delivery-info">
              <span class="icon">🏢</span>
              <div>
                <div class="delivery-name">${deliveryInfo.nombre}</div>
                <div class="delivery-address">${deliveryInfo.direccion || ''}</div>
                ${deliveryInfo.ciudad ? `<div class="delivery-city">${deliveryInfo.ciudad}</div>` : ''}
              </div>
            </div>
          ` : `
            <div class="delivery-info">
              <span class="icon">🏠</span>
              <div>
                <div class="delivery-address">${deliveryInfo?.direccion || 'Sin dirección'}</div>
                ${(deliveryInfo?.ciudad || deliveryInfo?.cp) ? `
                  <div class="delivery-city">${deliveryInfo.ciudad || ''} ${deliveryInfo.cp ? `• CP: ${deliveryInfo.cp}` : ''}</div>
                ` : ''}
              </div>
            </div>
          `}
        </div>

        <div class="divider"></div>

        <!-- Package Info and Price -->
        <div class="package-row">
          <div class="package-info">
            <span>📦 ${bultos} ${bultos === 1 ? 'bulto' : 'bultos'}</span>
            ${envio.peso_kg ? `<span>${envio.peso_kg} kg</span>` : ''}
          </div>
          <div class="price-info">
            <span class="payment-type">${TIPO_PAGO_LABELS[envio.tipo_pago || 'contado']}</span>
            <span class="price">$${envio.precio_total.toLocaleString('es-AR')}</span>
          </div>
        </div>

        ${(envio.descripcion || envio.notas) ? `
          <div class="divider"></div>
          <div class="section">
            <div class="section-title">OBS.</div>
            <div class="notes">${envio.descripcion || envio.notas}</div>
          </div>
        ` : ''}

        <div class="divider"></div>

        <!-- Sender -->
        <div class="section sender-section">
          <div class="section-title">REMITENTE</div>
          <div class="sender-name">
            ${envio.remitente 
              ? `${envio.remitente.nombre} ${envio.remitente.apellido || ''}`.trim()
              : 'Sin remitente'}
          </div>
          ${envio.remitente?.telefono ? `<div class="sender-phone">📞 ${envio.remitente.telefono}</div>` : ''}
        </div>
      </div>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Etiquetas - ${envio.tracking_number}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @page {
      size: ${size.width} ${size.height};
      margin: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      background: white;
    }
    
    .label {
      width: ${size.width};
      height: ${size.height};
      background: white;
      padding: ${labelSize === 'compact' ? '3mm' : '4mm'};
      display: flex;
      flex-direction: column;
      border: 2px solid #1e293b;
      box-sizing: border-box;
      page-break-after: always;
      overflow: hidden;
    }
    
    .label:last-child {
      page-break-after: auto;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 2mm;
      border-bottom: 1px solid #1e293b;
      margin-bottom: 2mm;
    }
    
    .origin-branch {
      display: flex;
      align-items: flex-start;
      gap: 2mm;
    }
    
    .icon {
      font-size: ${labelSize === 'compact' ? '10px' : '12px'};
    }
    
    .branch-name {
      font-size: ${labelSize === 'compact' ? '9px' : '10px'};
      font-weight: bold;
      color: #1e293b;
    }
    
    .branch-phone {
      font-size: ${labelSize === 'compact' ? '7px' : '8px'};
      color: #64748b;
    }
    
    .date {
      font-size: ${labelSize === 'compact' ? '7px' : '8px'};
      color: #64748b;
    }
    
    .tracking-section {
      text-align: center;
      margin-bottom: 2mm;
    }
    
    .tracking-number {
      font-family: monospace;
      font-size: ${labelSize === 'compact' ? '12px' : '14px'};
      font-weight: bold;
      letter-spacing: 1px;
      color: #1e293b;
    }
    
    .bulto-badge {
      display: inline-block;
      background-color: #1e293b;
      color: white;
      padding: 2mm 4mm;
      border-radius: 2mm;
      font-size: ${labelSize === 'compact' ? '9px' : '10px'};
      font-weight: bold;
      margin: 2mm 0;
    }
    
    .tracking-code {
      font-family: monospace;
      font-size: ${labelSize === 'compact' ? '8px' : '9px'};
      color: #64748b;
    }
    
    .qr-section {
      display: flex;
      justify-content: center;
      margin-bottom: 2mm;
    }
    
    .qr-container {
      background: white;
      padding: 2mm;
      border: 1px solid #d1d5db;
      border-radius: 2mm;
    }
    
    .qr-image {
      width: ${size.qrSize}px;
      height: ${size.qrSize}px;
      display: block;
    }
    
    .service-badge {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 2mm;
      padding: 2mm 4mm;
      border-radius: 2mm;
      margin-bottom: 2mm;
    }
    
    .service-label {
      font-size: ${labelSize === 'compact' ? '8px' : '9px'};
      font-weight: bold;
    }
    
    .divider {
      height: 1px;
      background-color: #1e293b;
      margin: 1.5mm 0;
    }
    
    .section {
      margin-bottom: 1.5mm;
    }
    
    .section-title {
      font-size: ${labelSize === 'compact' ? '7px' : '8px'};
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 1mm;
    }
    
    .recipient-name, .sender-name, .delivery-name {
      font-size: ${labelSize === 'compact' ? '10px' : '11px'};
      font-weight: bold;
      color: #1e293b;
    }
    
    .recipient-dni, .recipient-phone, .sender-phone {
      font-size: ${labelSize === 'compact' ? '8px' : '9px'};
      color: #374151;
    }
    
    .delivery-info {
      display: flex;
      align-items: flex-start;
      gap: 1mm;
    }
    
    .delivery-address {
      font-size: ${labelSize === 'compact' ? '9px' : '10px'};
      font-weight: bold;
      color: #1e293b;
    }
    
    .delivery-city {
      font-size: ${labelSize === 'compact' ? '7px' : '8px'};
      color: #64748b;
    }
    
    .package-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 1.5mm 0;
    }
    
    .package-info {
      display: flex;
      gap: 3mm;
      font-size: ${labelSize === 'compact' ? '8px' : '9px'};
      color: #374151;
    }
    
    .price-info {
      display: flex;
      align-items: center;
      gap: 2mm;
    }
    
    .payment-type {
      font-size: ${labelSize === 'compact' ? '7px' : '8px'};
      font-weight: 600;
      padding: 1mm 2mm;
      border: 1px solid #d1d5db;
      border-radius: 1mm;
      color: #374151;
    }
    
    .price {
      font-size: ${labelSize === 'compact' ? '10px' : '12px'};
      font-weight: bold;
      color: #1e293b;
    }
    
    .notes {
      font-size: ${labelSize === 'compact' ? '7px' : '8px'};
      color: #374151;
      line-height: 1.3;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    
    .sender-section {
      margin-bottom: 0;
    }
    
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      
      .label {
        margin: 0;
        border-width: 1px;
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
      return data as Envio;
    },
    enabled: !!envioId,
  });

  const handlePrint = () => {
    if (!envio) return;
    
    setIsPrinting(true);
    
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
      toast.error("Por favor permite ventanas emergentes para imprimir");
      setIsPrinting(false);
      return;
    }

    const tipoServicio = envio.tipo_servicio_detalle || 'sucursal_sucursal';
    const tipoConfig = TIPO_SERVICIO_CONFIG[tipoServicio as keyof typeof TIPO_SERVICIO_CONFIG] 
      || TIPO_SERVICIO_CONFIG.sucursal_sucursal;

    // Determine delivery address
    const getDeliveryAddress = () => {
      if (tipoServicio === 'sucursal_puerta' || tipoServicio === 'puerta_puerta') {
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
    const labelHTML = generateLabelHTML(envio, labelSize, tipoConfig, deliveryInfo);
    
    printWindow.document.write(labelHTML);
    printWindow.document.close();
    
    // Wait for images to load, then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        setIsPrinting(false);
      }, 500);
    };

    // Handle case where onload doesn't fire
    setTimeout(() => {
      setIsPrinting(false);
    }, 3000);
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

  // Determine delivery address for preview
  const getDeliveryAddress = () => {
    if (tipoServicio === 'sucursal_puerta' || tipoServicio === 'puerta_puerta') {
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

      {/* Preview - Just for visual reference */}
      <div className="p-4">
        <p className="text-sm text-muted-foreground mb-4">
          Vista previa de las etiquetas. Al imprimir se abrirá una ventana nueva con las etiquetas optimizadas.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {labels.map((bultoNum) => (
            <div 
              key={bultoNum}
              className="bg-white border-2 border-foreground rounded-lg p-3"
            >
              {/* Header: Sucursal Origen */}
              <div className="flex items-center justify-between border-b border-foreground pb-1 mb-2">
                <div className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  <div>
                    <p className="font-bold text-xs">
                      {envio.sucursal_origen?.codigo || 'XXX'} - {envio.sucursal_origen?.nombre || 'Sin sucursal'}
                    </p>
                    {envio.sucursal_origen?.telefono && (
                      <p className="text-[10px] text-muted-foreground">
                        Tel: {envio.sucursal_origen.telefono}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right text-[10px] text-muted-foreground">
                  {format(new Date(envio.created_at), 'dd/MM/yyyy', { locale: es })}
                </div>
              </div>

              {/* Tracking Number */}
              <div className="text-center mb-2">
                <p className="font-mono font-bold text-sm tracking-wider">
                  {envio.tracking_number}
                </p>
                
                <div className="inline-flex items-center gap-1 bg-foreground text-background px-3 py-1 rounded my-1">
                  <Package className="h-4 w-4" />
                  <span className="font-bold text-sm">BULTO {bultoNum} / {bultos}</span>
                </div>
                
                <p className="font-mono text-xs text-muted-foreground">
                  {envio.tracking_number}-{String(bultoNum).padStart(2, '0')}
                </p>
              </div>

              {/* QR Code Preview */}
              <div className="flex justify-center mb-2">
                <div className="bg-white p-1 border border-muted rounded">
                  <img 
                    src={getQRCodeUrl(`${window.location.origin}/tracking?q=${envio.tracking_number}-${String(bultoNum).padStart(2, '0')}`, 64)}
                    alt="QR Code"
                    className="w-16 h-16"
                  />
                </div>
              </div>

              {/* Tipo de Servicio Badge */}
              <div className="flex justify-center mb-2">
                <div 
                  className="px-2 py-1 rounded text-center text-xs"
                  style={{ backgroundColor: tipoConfig.bgColor, color: tipoConfig.textColor }}
                >
                  <span className="mr-1">{tipoConfig.icon}</span>
                  <span className="font-bold">{tipoConfig.label}</span>
                </div>
              </div>

              <Separator className="my-2 bg-foreground" />

              {/* Destinatario */}
              <div className="mb-2">
                <p className="text-[10px] font-semibold text-muted-foreground">DESTINATARIO</p>
                <p className="font-bold text-sm">
                  {envio.destinatario 
                    ? `${envio.destinatario.nombre} ${envio.destinatario.apellido || ''}`
                    : 'Sin destinatario'}
                </p>
                {envio.dni_destinatario && (
                  <p className="text-xs">DNI: {envio.dni_destinatario}</p>
                )}
                <div className="flex items-center gap-2 text-xs">
                  {envio.destinatario?.telefono && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {envio.destinatario.telefono}
                    </span>
                  )}
                </div>
              </div>

              <Separator className="my-2 bg-foreground" />

              {/* Delivery Address */}
              <div className="mb-2">
                <p className="text-[10px] font-semibold text-muted-foreground">
                  {deliveryInfo?.type === 'sucursal' ? 'RETIRA EN SUCURSAL' : 'ENTREGAR EN'}
                </p>
                {deliveryInfo?.type === 'sucursal' ? (
                  <div className="flex items-start gap-1">
                    <Building2 className="h-3 w-3 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs">{deliveryInfo.nombre}</p>
                      <p className="text-xs">{deliveryInfo.direccion}</p>
                      {deliveryInfo.ciudad && (
                        <p className="text-xs text-muted-foreground">{deliveryInfo.ciudad}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-1">
                    <Home className="h-3 w-3 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs">{deliveryInfo?.direccion || 'Sin dirección'}</p>
                      {(deliveryInfo?.ciudad || deliveryInfo?.cp) && (
                        <p className="text-xs text-muted-foreground">
                          {deliveryInfo.ciudad} {deliveryInfo.cp && `• CP: ${deliveryInfo.cp}`}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Separator className="my-2 bg-foreground" />

              {/* Package info and price */}
              <div className="flex justify-between items-center mb-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {bultos} {bultos === 1 ? 'bulto' : 'bultos'}
                  </span>
                  {envio.peso_kg && (
                    <span>{envio.peso_kg} kg</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="font-bold text-[10px] px-1 py-0">
                    {TIPO_PAGO_LABELS[envio.tipo_pago || 'contado']}
                  </Badge>
                  <span className="font-bold text-sm">
                    ${envio.precio_total.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {(envio.descripcion || envio.notas) && (
                <>
                  <Separator className="my-2 bg-foreground" />
                  <div className="text-xs">
                    <p className="text-[10px] font-semibold text-muted-foreground">OBS.</p>
                    <p className="line-clamp-2">{envio.descripcion || envio.notas}</p>
                  </div>
                </>
              )}

              <Separator className="my-2 bg-foreground" />

              {/* Sender */}
              <div className="text-xs">
                <p className="text-[10px] font-semibold text-muted-foreground">REMITENTE</p>
                <p className="font-medium">
                  {envio.remitente 
                    ? `${envio.remitente.nombre} ${envio.remitente.apellido || ''}`.trim()
                    : 'Sin remitente'}
                </p>
                {envio.remitente?.telefono && (
                  <p className="flex items-center gap-1">
                    <Phone className="h-2 w-2" />
                    {envio.remitente.telefono}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
