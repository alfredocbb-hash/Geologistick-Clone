import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowLeft, 
  Printer, 
  Building2, 
  Home, 
  Package,
  Phone,
  MapPin,
  Truck,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

  return (
    <div className="space-y-6">
      {/* Header - No se imprime */}
      <div className="flex items-center justify-between print:hidden">
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
        <Button onClick={handlePrint} className="gradient-primary">
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
        </Button>
      </div>

      {/* Labels */}
      <div className="space-y-8 print:space-y-0">
        {labels.map((bultoNum) => (
          <div 
            key={bultoNum}
            className="bg-white border-2 border-foreground rounded-lg p-4 max-w-[400px] mx-auto print:break-after-page print:max-w-none print:mx-0 print:rounded-none print:border-0 print:shadow-none"
            style={{ printColorAdjust: 'exact' }}
          >
            {/* Header: Sucursal Origen */}
            <div className="flex items-center justify-between border-b-2 border-foreground pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                <div>
                  <p className="font-bold text-sm">
                    {envio.sucursal_origen?.codigo || 'XXX'} - {envio.sucursal_origen?.nombre || 'Sin sucursal'}
                  </p>
                  {envio.sucursal_origen?.telefono && (
                    <p className="text-xs text-muted-foreground">
                      Tel: {envio.sucursal_origen.telefono}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {format(new Date(envio.created_at), 'dd/MM/yyyy', { locale: es })}
              </div>
            </div>

            {/* Tracking Number */}
            <div className="text-center mb-3">
              <p className="font-mono font-bold text-lg tracking-wider">
                {envio.tracking_number}
              </p>
              
              {/* Bulto indicator */}
              <div className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-lg my-2">
                <Package className="h-5 w-5" />
                <span className="font-bold text-lg">BULTO {bultoNum} / {bultos}</span>
              </div>
              
              {/* Individual package code */}
              <p className="font-mono text-sm text-muted-foreground">
                {envio.tracking_number}-{String(bultoNum).padStart(2, '0')}
              </p>
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-3">
              <div className="bg-white p-2 rounded-lg">
                <QRCodeSVG 
                  value={`${window.location.origin}/tracking?q=${envio.tracking_number}-${String(bultoNum).padStart(2, '0')}`}
                  size={96}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>

            {/* Tipo de Servicio Badge */}
            <div className="flex justify-center mb-3">
              <div className={`${tipoConfig.color} px-4 py-2 rounded-lg text-center`}>
                <span className="text-xl mr-2">{tipoConfig.icon}</span>
                <span className="font-bold">{tipoConfig.label}</span>
              </div>
            </div>

            <Separator className="my-3 bg-foreground" />

            {/* Destinatario */}
            <div className="mb-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">DESTINATARIO</p>
              <p className="font-bold">
                {envio.destinatario 
                  ? `${envio.destinatario.nombre} ${envio.destinatario.apellido || ''}`
                  : 'Sin destinatario'}
              </p>
              {envio.dni_destinatario && (
                <p className="text-sm">DNI: {envio.dni_destinatario}</p>
              )}
              <div className="flex items-center gap-4 text-sm">
                {envio.destinatario?.telefono && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {envio.destinatario.telefono}
                  </span>
                )}
                {envio.whatsapp_destinatario && (
                  <span className="text-success">WA: {envio.whatsapp_destinatario}</span>
                )}
              </div>
            </div>

            <Separator className="my-3 bg-foreground" />

            {/* Dirección de entrega o sucursal de retiro */}
            <div className="mb-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                {deliveryInfo?.type === 'sucursal' ? 'RETIRA EN SUCURSAL' : 'ENTREGAR EN'}
              </p>
              {deliveryInfo?.type === 'sucursal' ? (
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-bold">{deliveryInfo.nombre}</p>
                    <p className="text-sm">{deliveryInfo.direccion}</p>
                    {deliveryInfo.ciudad && (
                      <p className="text-sm text-muted-foreground">{deliveryInfo.ciudad}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <Home className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-bold">{deliveryInfo?.direccion || 'Sin dirección'}</p>
                    {(deliveryInfo?.ciudad || deliveryInfo?.cp) && (
                      <p className="text-sm text-muted-foreground">
                        {deliveryInfo.ciudad} {deliveryInfo.cp && `• CP: ${deliveryInfo.cp}`}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Separator className="my-3 bg-foreground" />

            {/* Info del paquete */}
            <div className="flex justify-between items-center mb-3 text-sm">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Package className="h-4 w-4" />
                  {bultos} {bultos === 1 ? 'bulto' : 'bultos'}
                </span>
                {envio.peso_kg && (
                  <span>{envio.peso_kg} kg</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-bold">
                  {TIPO_PAGO_LABELS[envio.tipo_pago || 'contado']}
                </Badge>
                <span className="font-bold text-lg">
                  ${envio.precio_total.toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* Notas */}
            {(envio.descripcion || envio.notas) && (
              <>
                <Separator className="my-3 bg-foreground" />
                <div className="text-sm">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">OBSERVACIONES</p>
                  <p>{envio.descripcion || envio.notas}</p>
                </div>
              </>
            )}

            <Separator className="my-3 bg-foreground" />

            {/* Remitente */}
            <div className="text-sm">
              <p className="text-xs font-semibold text-muted-foreground mb-1">REMITENTE</p>
              <p className="font-medium">
                {envio.remitente 
                  ? `${envio.remitente.nombre} ${envio.remitente.apellido || ''}`.trim()
                  : 'Sin remitente'}
              </p>
              {envio.dni_remitente && (
                <p className="text-xs">DNI: {envio.dni_remitente}</p>
              )}
              {envio.remitente?.telefono && (
                <p className="text-xs flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {envio.remitente.telefono}
                </p>
              )}
              {envio.sucursal_origen && (
                <p className="text-xs text-muted-foreground mt-1">
                  {envio.sucursal_origen.codigo} - {envio.sucursal_origen.nombre}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: 100mm 150mm;
            margin: 5mm;
          }
          
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:break-after-page {
            break-after: page;
          }
        }
      `}</style>
    </div>
  );
}