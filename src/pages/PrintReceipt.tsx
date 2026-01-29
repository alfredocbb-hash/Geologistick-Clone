import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Download, 
  Loader2, 
  Building2, 
  User, 
  Package, 
  MapPin,
  Phone,
  FileText,
  QrCode,
  Printer,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { generateShipmentReceiptPDF } from '@/lib/generateShipmentReceiptPDF';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

const TIPO_PAGO_LABELS: Record<string, string> = {
  contado: 'Contado',
  destino: 'Pago en Destino',
  cuenta_corriente: 'Cuenta Corriente',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function PrintReceipt() {
  const [searchParams] = useSearchParams();
  const envioId = searchParams.get('id');
  const [isGenerating, setIsGenerating] = useState<'agencia' | 'cliente' | null>(null);

  const { data: envio, isLoading: loadingEnvio } = useQuery({
    queryKey: ['receipt-envio', envioId],
    queryFn: async () => {
      if (!envioId) return null;
      
      const { data, error } = await supabase
        .from('envios')
        .select(`
          *,
          remitente:clientes!envios_remitente_id_fkey(nombre, apellido, telefono, direccion, ciudad),
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, telefono, direccion, ciudad),
          sucursal_origen:sucursales!envios_sucursal_origen_id_fkey(nombre, codigo, direccion, ciudad, telefono),
          sucursal_destino:sucursales!envios_sucursal_destino_id_fkey(nombre, codigo, direccion, ciudad, telefono)
        `)
        .eq('id', envioId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!envioId,
  });

  const { data: detalles } = useQuery({
    queryKey: ['receipt-detalles', envioId],
    queryFn: async () => {
      if (!envioId) return [];
      
      const { data, error } = await supabase
        .from('envio_detalles')
        .select('nombre_concepto, monto')
        .eq('envio_id', envioId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!envioId,
  });

  const { data: branding } = useQuery({
    queryKey: ['receipt-branding', envio?.tenant_id],
    queryFn: async () => {
      if (!envio?.tenant_id) return null;
      
      const { data, error } = await supabase
        .from('tenant_branding')
        .select('logo_light, nombre_app, color_primario')
        .eq('tenant_id', envio.tenant_id)
        .single();
      
      if (error) return null;
      return data;
    },
    enabled: !!envio?.tenant_id,
  });

  const trackingUrl = `${window.location.origin}/tracking?q=${envio?.tracking_number}`;

  const handleGeneratePDF = async (copyType: 'agencia' | 'cliente') => {
    if (!envio) return;
    
    setIsGenerating(copyType);
    try {
      await generateShipmentReceiptPDF(
        envio as any,
        detalles || [],
        branding,
        trackingUrl,
        copyType
      );
      toast.success(`Comprobante (${copyType === 'agencia' ? 'Copia Agencia' : 'Copia Cliente'}) descargado`);
    } catch (error) {
      console.error('Error generating receipt:', error);
      toast.error('Error al generar el comprobante');
    } finally {
      setIsGenerating(null);
    }
  };

  if (loadingEnvio) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!envio) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Package className="h-16 w-16 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">Envío no encontrado</p>
        <Button asChild variant="outline">
          <Link to="/shipments">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Envíos
          </Link>
        </Button>
      </div>
    );
  }

  const remitenteNombre = envio.remitente 
    ? `${envio.remitente.nombre} ${envio.remitente.apellido || ''}` 
    : envio.nombre_remitente || '-';
  
  const destNombre = envio.destinatario 
    ? `${envio.destinatario.nombre} ${envio.destinatario.apellido || ''}` 
    : envio.nombre_destinatario || '-';

  const totalConceptos = (detalles || []).reduce((sum, d) => sum + (d.monto || 0), 0);
  const flete = envio.precio_total - totalConceptos;

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button asChild variant="ghost" size="sm">
            <Link to="/shipments">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Link>
          </Button>
          
          <div className="flex gap-2">
            <Button 
              onClick={() => handleGeneratePDF('agencia')}
              disabled={isGenerating !== null}
              variant="outline"
            >
              {isGenerating === 'agencia' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Copia Agencia
            </Button>
            <Button 
              onClick={() => handleGeneratePDF('cliente')}
              disabled={isGenerating !== null}
            >
              {isGenerating === 'cliente' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              Copia Cliente
            </Button>
          </div>
        </div>

        {/* Receipt Preview */}
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-slate-50">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {branding?.logo_light ? (
                  <img 
                    src={branding.logo_light} 
                    alt="Logo" 
                    className="h-12 w-auto object-contain"
                  />
                ) : (
                  <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-lg text-primary">
                    {branding?.nombre_app || 'Geologistick'}
                  </CardTitle>
                  {envio.sucursal_origen && (
                    <p className="text-sm text-muted-foreground">
                      {envio.sucursal_origen.direccion}
                      {envio.sucursal_origen.telefono && ` • Tel: ${envio.sucursal_origen.telefono}`}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-lg font-bold text-primary">Guía Nº: {envio.tracking_number}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(envio.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  DOCUMENTO NO VÁLIDO COMO FACTURA
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Origen / Destino */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-primary/10 rounded-lg p-3">
                <p className="text-xs font-semibold text-primary mb-1">ORIGEN</p>
                <p className="font-medium">{envio.sucursal_origen?.ciudad || envio.ciudad_retiro || '-'}</p>
              </div>
              <div className="bg-green-500/10 rounded-lg p-3">
                <p className="text-xs font-semibold text-green-700 mb-1">DESTINO</p>
                <p className="font-medium">{envio.sucursal_destino?.ciudad || envio.ciudad_entrega || '-'}</p>
              </div>
            </div>

            {/* Remitente / Destinatario */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground">REMITENTE</p>
                </div>
                <p className="font-medium">{remitenteNombre}</p>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <MapPin className="h-3 w-3 mt-1 flex-shrink-0" />
                    {envio.remitente?.direccion || envio.direccion_retiro || '-'}
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-3 w-3 flex-shrink-0" />
                    {envio.remitente?.telefono || '-'}
                  </p>
                  {envio.dni_remitente && (
                    <p className="flex items-center gap-2">
                      <FileText className="h-3 w-3 flex-shrink-0" />
                      DNI: {envio.dni_remitente}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground">DESTINATARIO</p>
                </div>
                <p className="font-medium">{destNombre}</p>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <MapPin className="h-3 w-3 mt-1 flex-shrink-0" />
                    {envio.destinatario?.direccion || envio.direccion_entrega || '-'}
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-3 w-3 flex-shrink-0" />
                    {envio.destinatario?.telefono || envio.whatsapp_destinatario || '-'}
                  </p>
                  {envio.dni_destinatario && (
                    <p className="flex items-center gap-2">
                      <FileText className="h-3 w-3 flex-shrink-0" />
                      DNI: {envio.dni_destinatario}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Condición de venta */}
            <div className="border rounded-lg p-3">
              <p className="text-sm">
                <span className="font-medium">Condición de Venta:</span>{' '}
                {TIPO_PAGO_LABELS[envio.tipo_pago || 'contado'] || envio.tipo_pago || 'Contado'}
              </p>
            </div>

            {/* Descripción / Conceptos */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">DESCRIPCIÓN DEL ENVÍO</p>
                <div className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Bultos:</span> {envio.cantidad_bultos || 1}</p>
                  {envio.descripcion && (
                    <p><span className="text-muted-foreground">Descripción:</span> {envio.descripcion}</p>
                  )}
                  {envio.peso_kg && (
                    <p><span className="text-muted-foreground">Peso:</span> {envio.peso_kg} kg</p>
                  )}
                  {envio.valor_declarado && (
                    <p><span className="text-muted-foreground">Valor Declarado:</span> {formatCurrency(envio.valor_declarado)}</p>
                  )}
                </div>
              </div>
              
              <div className="border rounded-lg p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">CONCEPTOS</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Flete:</span>
                    <span>{formatCurrency(flete > 0 ? flete : envio.precio_total)}</span>
                  </div>
                  {(detalles || []).map((detalle, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-muted-foreground">{detalle.nombre_concepto}:</span>
                      <span>{formatCurrency(detalle.monto)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* QR + Total */}
            <div className="border rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white rounded-lg border">
                  <QRCodeSVG value={trackingUrl} size={80} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <QrCode className="h-3 w-3" />
                    Escanear para tracking
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    {envio.tracking_number}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-sm text-muted-foreground">TOTAL</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(envio.precio_total)}
                </p>
              </div>
            </div>

            {/* Firmas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <p className="text-xs font-semibold text-muted-foreground mb-6">REMITENTE</p>
                <div className="border-t border-dashed pt-2 mx-4">
                  <p className="text-xs text-muted-foreground">FIRMA Y ACLARACIÓN</p>
                </div>
                <div className="border-t border-dashed pt-2 mx-4 mt-4">
                  <p className="text-xs text-muted-foreground">DNI</p>
                </div>
              </div>
              
              <div className="border rounded-lg p-4 text-center">
                <p className="text-xs font-semibold text-muted-foreground mb-6">DESTINATARIO</p>
                <div className="border-t border-dashed pt-2 mx-4">
                  <p className="text-xs text-muted-foreground">FIRMA Y ACLARACIÓN</p>
                </div>
                <div className="flex gap-4 mt-4">
                  <div className="flex-1 border-t border-dashed pt-2">
                    <p className="text-xs text-muted-foreground">DNI</p>
                  </div>
                  <div className="flex-1 border-t border-dashed pt-2">
                    <p className="text-xs text-muted-foreground">FECHA</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Observaciones */}
            <div className="border rounded-lg p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">OBSERVACIONES</p>
              {envio.notas && <p className="text-sm mb-2">{envio.notas}</p>}
              <p className="text-xs text-muted-foreground italic">
                Declaro que esta encomienda no contiene dinero en efectivo, cheques ni valores negociables.
                El remitente acepta los términos y condiciones del servicio de transporte.
              </p>
            </div>

            {/* Copy Badge */}
            <div className="flex justify-end">
              <Badge variant="secondary" className="text-xs">
                VISTA PREVIA
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
