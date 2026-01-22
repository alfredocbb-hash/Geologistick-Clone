import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowLeft, 
  Printer, 
  Building2, 
  Home, 
  Package,
  Phone,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type PrintFormat = 'grid-2x3' | 'grid-3x2' | 'single-column';

const TIPO_SERVICIO_CONFIG = {
  sucursal_sucursal: { 
    label: 'SUCURSAL A SUCURSAL', 
    icon: '🏢→🏢',
    color: 'bg-primary text-primary-foreground',
  },
  sucursal_puerta: { 
    label: 'ENTREGA A DOMICILIO', 
    icon: '🏢→🏠',
    color: 'bg-success text-success-foreground',
  },
  puerta_sucursal: { 
    label: 'RETIRO + SUCURSAL', 
    icon: '🏠→🏢',
    color: 'bg-warning text-warning-foreground',
  },
  puerta_puerta: { 
    label: 'PUERTA A PUERTA', 
    icon: '🏠→🏠',
    color: 'bg-accent text-accent-foreground',
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

export default function PrintLabel() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [printFormat, setPrintFormat] = useState<PrintFormat>('grid-2x3');
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
    window.print();
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

  // Determinar dirección de entrega
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
    // Retira en sucursal
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

  const formatLabels = {
    'grid-2x3': 'Grid 2×3 (Horizontal - 6/página)',
    'grid-3x2': 'Grid 3×2 (Horizontal - 6/página)',
    'single-column': 'Una columna (Vertical - 3/página)',
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - No se imprime */}
      <div className="flex items-center justify-between p-4 no-print flex-wrap gap-4">
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
            <span className="text-sm text-muted-foreground">Formato:</span>
            <Select value={printFormat} onValueChange={(v) => setPrintFormat(v as PrintFormat)}>
              <SelectTrigger className="w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid-2x3">Grid 2×3 (Horizontal - 6/página)</SelectItem>
                <SelectItem value="grid-3x2">Grid 3×2 (Horizontal - 6/página)</SelectItem>
                <SelectItem value="single-column">Una columna (Vertical - 3/página)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handlePrint} className="gradient-primary">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Labels Container - Clase print-content para estrategia de visibilidad */}
      <div className="print-content p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {labels.map((bultoNum) => (
            <div 
              key={bultoNum}
              className="label-container bg-white border-2 border-foreground rounded-lg p-3"
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
                
                {/* Bulto indicator */}
                <div className="inline-flex items-center gap-1 bg-foreground text-background px-3 py-1 rounded my-1">
                  <Package className="h-4 w-4" />
                  <span className="font-bold text-sm">BULTO {bultoNum} / {bultos}</span>
                </div>
                
                {/* Individual package code */}
                <p className="font-mono text-xs text-muted-foreground">
                  {envio.tracking_number}-{String(bultoNum).padStart(2, '0')}
                </p>
              </div>

              {/* QR Code */}
              <div className="flex justify-center mb-2">
                <div className="bg-white p-1">
                  <QRCodeSVG 
                    value={`${window.location.origin}/tracking?q=${envio.tracking_number}-${String(bultoNum).padStart(2, '0')}`}
                    size={64}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              </div>

              {/* Tipo de Servicio Badge */}
              <div className="flex justify-center mb-2">
                <div className={`${tipoConfig.color} px-2 py-1 rounded text-center text-xs`}>
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

              {/* Dirección de entrega o sucursal de retiro */}
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

              {/* Info del paquete y precio */}
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

              {/* Notas */}
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

              {/* Remitente */}
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

      {/* Print Styles - Dinámico según formato seleccionado */}
      <style>{`
        @media print {
          @page {
            size: ${printFormat === 'single-column' ? 'A4 portrait' : 'A4 landscape'};
            margin: 5mm;
          }
          
          /* FORZAR impresión de colores de fondo */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          /* Ocultar elementos que no se deben imprimir */
          .no-print,
          header,
          nav,
          footer,
          button,
          select,
          [data-radix-portal],
          .min-h-screen > .no-print {
            display: none !important;
            visibility: hidden !important;
          }
          
          /* Reset del body, html y root de React */
          html, body, #root {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          
          /* Asegurar que print-content sea visible */
          .print-content {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          ${printFormat === 'grid-2x3' ? `
            /* Grid 2×3: 2 columnas × 3 filas = 6 etiquetas por página */
            html, body, #root {
              width: 297mm !important;
            }
            
            .print-content {
              width: 287mm !important;
            }
            
            .print-content > div {
              display: grid !important;
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 3mm !important;
              width: 287mm !important;
            }
            
            .label-container {
              width: 140mm !important;
              min-width: 140mm !important;
              max-width: 140mm !important;
              height: 90mm !important;
              max-height: 90mm !important;
              overflow: hidden !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              padding: 3mm !important;
              box-sizing: border-box !important;
              border: 1px solid black !important;
              border-radius: 0 !important;
              background: white !important;
            }
            
            .label-container:nth-child(6n) {
              page-break-after: always !important;
              break-after: page !important;
            }
            
            .label-container:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
          ` : printFormat === 'grid-3x2' ? `
            /* Grid 3×2: 3 columnas × 2 filas = 6 etiquetas por página */
            html, body, #root {
              width: 297mm !important;
            }
            
            .print-content {
              width: 287mm !important;
            }
            
            .print-content > div {
              display: grid !important;
              grid-template-columns: repeat(3, 1fr) !important;
              gap: 3mm !important;
              width: 287mm !important;
            }
            
            .label-container {
              width: 93mm !important;
              min-width: 93mm !important;
              max-width: 93mm !important;
              height: 95mm !important;
              max-height: 95mm !important;
              overflow: hidden !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              padding: 2mm !important;
              box-sizing: border-box !important;
              border: 1px solid black !important;
              border-radius: 0 !important;
              background: white !important;
            }
            
            .label-container:nth-child(6n) {
              page-break-after: always !important;
              break-after: page !important;
            }
            
            .label-container:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
          ` : `
            /* Una columna: 1 columna × 3 filas = 3 etiquetas por página */
            html, body, #root {
              width: 210mm !important;
            }
            
            .print-content {
              width: 200mm !important;
              margin: 0 auto !important;
            }
            
            .print-content > div {
              display: flex !important;
              flex-direction: column !important;
              width: 200mm !important;
              gap: 0 !important;
            }
            
            .label-container {
              width: 200mm !important;
              min-width: 200mm !important;
              max-width: 200mm !important;
              height: 90mm !important;
              max-height: 90mm !important;
              overflow: hidden !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              margin-bottom: 2mm !important;
              padding: 4mm !important;
              box-sizing: border-box !important;
              border: 1px solid black !important;
              border-radius: 0 !important;
              background: white !important;
            }
            
            .label-container:nth-child(3n) {
              page-break-after: always !important;
              break-after: page !important;
              margin-bottom: 0 !important;
            }
            
            .label-container:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
          `}
          
          /* Evitar cortes dentro de elementos de la etiqueta */
          .label-container,
          .label-container > * {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          
          /* QR Code a tamaño físico fijo - 25mm */
          .label-container .flex.justify-center.mb-2 > div {
            width: 25mm !important;
            height: 25mm !important;
          }
          
          .label-container .flex.justify-center.mb-2 svg[viewBox] {
            width: 25mm !important;
            height: 25mm !important;
            min-width: 25mm !important;
            min-height: 25mm !important;
          }
          
          /* COLORES específicos para badges - forzar valores HSL a HEX */
          .label-container .bg-foreground {
            background-color: #1e293b !important;
            color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .label-container .bg-primary {
            background-color: #3b82f6 !important;
            color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .label-container .bg-success {
            background-color: #16a34a !important;
            color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .label-container .bg-warning {
            background-color: #f59e0b !important;
            color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .label-container .bg-accent {
            background-color: #8b5cf6 !important;
            color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Ajustar tamaños de fuente para impresión */
          .label-container .text-xs {
            font-size: ${printFormat === 'grid-3x2' ? '8px' : '9px'} !important;
          }
          
          .label-container .text-sm {
            font-size: ${printFormat === 'grid-3x2' ? '9px' : '11px'} !important;
          }
          
          .label-container .text-\\[10px\\] {
            font-size: ${printFormat === 'grid-3x2' ? '7px' : '8px'} !important;
          }
          
          /* Reducir espaciados para que quepa todo */
          .label-container .mb-2 {
            margin-bottom: ${printFormat === 'grid-3x2' ? '1mm' : '1.5mm'} !important;
          }
          
          .label-container .my-2 {
            margin-top: 1mm !important;
            margin-bottom: 1mm !important;
          }
          
          .label-container .pb-1 {
            padding-bottom: 1mm !important;
          }
          
          /* Iconos más pequeños (excepto el QR) */
          .label-container svg:not([viewBox]) {
            width: ${printFormat === 'grid-3x2' ? '8px' : '10px'} !important;
            height: ${printFormat === 'grid-3x2' ? '8px' : '10px'} !important;
          }
          
          .label-container .h-4:not(svg[viewBox]) {
            height: ${printFormat === 'grid-3x2' ? '10px' : '12px'} !important;
            width: ${printFormat === 'grid-3x2' ? '10px' : '12px'} !important;
          }
          
          .label-container .h-3 {
            height: ${printFormat === 'grid-3x2' ? '8px' : '10px'} !important;
            width: ${printFormat === 'grid-3x2' ? '8px' : '10px'} !important;
          }
          
          .label-container .h-2 {
            height: 8px !important;
            width: 8px !important;
          }
        }
      `}</style>
    </div>
  );
}