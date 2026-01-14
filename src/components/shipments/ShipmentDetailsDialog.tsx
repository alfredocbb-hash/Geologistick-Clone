import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { 
  Package, 
  User, 
  MapPin, 
  Phone, 
  Building2,
  Truck,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Scale,
  Boxes,
  Calendar,
  FileText,
  Printer,
  Camera,
  PenTool,
  AlertTriangle,
  ImageOff,
  Download,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { generateEPODPDF } from '@/lib/generateEPODPDF';

type ShipmentStatus = Database['public']['Enums']['shipment_status'];

interface ShipmentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  envioId: string | null;
}

const statusConfig: Record<ShipmentStatus, { label: string; color: string; icon: React.ElementType }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-500', icon: Clock },
  recogido: { label: 'Recogido', color: 'bg-blue-500', icon: Package },
  en_bodega: { label: 'En Bodega', color: 'bg-purple-500', icon: Building2 },
  en_transito: { label: 'En Tránsito', color: 'bg-blue-600', icon: Truck },
  en_reparto: { label: 'En Reparto', color: 'bg-orange-500', icon: Truck },
  entregado: { label: 'Entregado', color: 'bg-green-500', icon: CheckCircle },
  devuelto: { label: 'Devuelto', color: 'bg-red-500', icon: AlertCircle },
  cancelado: { label: 'Cancelado', color: 'bg-gray-500', icon: AlertCircle },
};

const TIPO_PAGO_LABELS: Record<string, string> = {
  contado: 'Contado',
  destino: 'Pago en Destino',
  cuenta_corriente: 'Cuenta Corriente',
};

const TIPO_SERVICIO_LABELS: Record<string, string> = {
  sucursal_sucursal: 'Sucursal a Sucursal',
  sucursal_puerta: 'Sucursal a Domicilio',
  puerta_sucursal: 'Domicilio a Sucursal',
  puerta_puerta: 'Puerta a Puerta',
};

export function ShipmentDetailsDialog({ 
  open, 
  onOpenChange, 
  envioId 
}: ShipmentDetailsDialogProps) {
  const [isGeneratingEPOD, setIsGeneratingEPOD] = useState(false);
  
  const { data: envio, isLoading } = useQuery({
    queryKey: ['envio-details', envioId],
    queryFn: async () => {
      if (!envioId) return null;
      
      const { data, error } = await supabase
        .from('envios')
        .select(`
          *,
          remitente:clientes!envios_remitente_id_fkey(nombre, apellido, telefono, direccion, ciudad, email),
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, telefono, direccion, ciudad, email),
          sucursal_origen:sucursales!envios_sucursal_origen_id_fkey(nombre, codigo, direccion, ciudad, telefono),
          sucursal_destino:sucursales!envios_sucursal_destino_id_fkey(nombre, codigo, direccion, ciudad, telefono)
        `)
        .eq('id', envioId)
        .single();
      
      if (error) throw error;
      
      // Fetch driver profile separately if assigned
      let chofer = null;
      if (data.chofer_id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('nombre, apellido, telefono')
          .eq('user_id', data.chofer_id)
          .single();
        chofer = profileData;
      }
      
      return { ...data, chofer };
    },
    enabled: open && !!envioId,
  });

  const { data: detalles } = useQuery({
    queryKey: ['envio-detalles', envioId],
    queryFn: async () => {
      if (!envioId) return [];
      
      const { data, error } = await supabase
        .from('envio_detalles')
        .select('*')
        .eq('envio_id', envioId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!envioId,
  });

  const { data: incidentes } = useQuery({
    queryKey: ['envio-incidentes', envioId],
    queryFn: async () => {
      if (!envioId) return [];
      
      const { data, error } = await supabase
        .from('incidentes')
        .select('*')
        .eq('envio_id', envioId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!envioId,
  });

  const { data: historial } = useQuery({
    queryKey: ['envio-historial', envioId],
    queryFn: async () => {
      if (!envioId) return [];
      
      const { data, error } = await supabase
        .from('envio_historial')
        .select('*')
        .eq('envio_id', envioId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!envioId,
  });

  const handleDownloadEPOD = async () => {
    if (!envio) return;
    
    setIsGeneratingEPOD(true);
    try {
      await generateEPODPDF(envio as any, historial || [], incidentes || []);
      toast.success('EPOD descargado exitosamente');
    } catch (error) {
      console.error('Error generating EPOD:', error);
      toast.error('Error al generar el EPOD');
    } finally {
      setIsGeneratingEPOD(false);
    }
  };

  const InfoRow = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) => (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value || '-'}</p>
      </div>
    </div>
  );

  const status = envio?.estado as ShipmentStatus;
  const statusInfo = statusConfig[status];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <span>Detalles del Envío</span>
            </div>
            {envio && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDownloadEPOD}
                  disabled={isGeneratingEPOD}
                >
                  {isGeneratingEPOD ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  EPOD
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/print-label?id=${envio.id}`}>
                    <Printer className="h-4 w-4 mr-2" />
                    Etiqueta
                  </Link>
                </Button>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : envio ? (
          <ScrollArea className="max-h-[65vh]">
            {/* Header Info */}
            <div className="mb-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-lg font-bold text-primary">
                  {envio.tracking_number}
                </span>
                {statusInfo && (
                  <Badge className={`${statusInfo.color} text-white`}>
                    {statusInfo.label}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {envio.created_at && format(new Date(envio.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                </span>
                {envio.tipo_servicio_detalle && (
                  <Badge variant="outline">
                    {TIPO_SERVICIO_LABELS[envio.tipo_servicio_detalle] || envio.tipo_servicio_detalle}
                  </Badge>
                )}
              </div>
            </div>

            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="contactos">Contactos</TabsTrigger>
                <TabsTrigger value="financiero">Financiero</TabsTrigger>
                <TabsTrigger value="evidencia">Evidencia</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4 mt-4">
                {/* Sucursales */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">ORIGEN</p>
                    <div className="flex items-start gap-2">
                      <Building2 className="h-4 w-4 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">
                          {envio.sucursal_origen?.codigo && `[${envio.sucursal_origen.codigo}] `}
                          {envio.sucursal_origen?.nombre || 'Sin sucursal'}
                        </p>
                        <p className="text-xs text-muted-foreground">{envio.sucursal_origen?.direccion}</p>
                        <p className="text-xs text-muted-foreground">{envio.sucursal_origen?.ciudad}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 border rounded-lg">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">DESTINO</p>
                    <div className="flex items-start gap-2">
                      <Building2 className="h-4 w-4 text-success mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">
                          {envio.sucursal_destino?.codigo && `[${envio.sucursal_destino.codigo}] `}
                          {envio.sucursal_destino?.nombre || 'Sin sucursal'}
                        </p>
                        <p className="text-xs text-muted-foreground">{envio.sucursal_destino?.direccion}</p>
                        <p className="text-xs text-muted-foreground">{envio.sucursal_destino?.ciudad}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Paquete */}
                <div className="p-3 border rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">PAQUETE</p>
                  <div className="grid grid-cols-3 gap-4">
                    <InfoRow icon={Boxes} label="Bultos" value={envio.cantidad_bultos || 1} />
                    <InfoRow icon={Scale} label="Peso" value={envio.peso_kg ? `${envio.peso_kg} kg` : '-'} />
                    <InfoRow icon={Package} label="Dimensiones" value={envio.dimensiones || '-'} />
                  </div>
                  {envio.descripcion && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground">Descripción</p>
                      <p className="text-sm">{envio.descripcion}</p>
                    </div>
                  )}
                </div>

                {/* Chofer asignado */}
                {envio.chofer && (
                  <div className="p-3 border rounded-lg">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">CHOFER ASIGNADO</p>
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      <span className="font-medium">
                        {envio.chofer.nombre} {envio.chofer.apellido}
                      </span>
                      {envio.chofer.telefono && (
                        <span className="text-sm text-muted-foreground">
                          • {envio.chofer.telefono}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Notas */}
                {envio.notas && (
                  <div className="p-3 border rounded-lg">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">NOTAS</p>
                    <p className="text-sm">{envio.notas}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="contactos" className="space-y-4 mt-4">
                {/* Remitente */}
                <div className="p-4 border rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground mb-3">REMITENTE</p>
                  {envio.remitente ? (
                    <div className="space-y-2">
                      <InfoRow 
                        icon={User} 
                        label="Nombre" 
                        value={`${envio.remitente.nombre} ${envio.remitente.apellido || ''}`} 
                      />
                      <InfoRow icon={Phone} label="Teléfono" value={envio.remitente.telefono} />
                      <InfoRow icon={MapPin} label="Dirección" value={`${envio.remitente.direccion}${envio.remitente.ciudad ? `, ${envio.remitente.ciudad}` : ''}`} />
                      {envio.dni_remitente && (
                        <InfoRow icon={FileText} label="DNI" value={envio.dni_remitente} />
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin remitente registrado</p>
                  )}
                </div>

                {/* Destinatario */}
                <div className="p-4 border rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground mb-3">DESTINATARIO</p>
                  {envio.destinatario ? (
                    <div className="space-y-2">
                      <InfoRow 
                        icon={User} 
                        label="Nombre" 
                        value={`${envio.destinatario.nombre} ${envio.destinatario.apellido || ''}`} 
                      />
                      <InfoRow icon={Phone} label="Teléfono" value={envio.destinatario.telefono} />
                      <InfoRow icon={MapPin} label="Dirección" value={`${envio.destinatario.direccion}${envio.destinatario.ciudad ? `, ${envio.destinatario.ciudad}` : ''}`} />
                      {envio.dni_destinatario && (
                        <InfoRow icon={FileText} label="DNI" value={envio.dni_destinatario} />
                      )}
                      {envio.whatsapp_destinatario && (
                        <InfoRow icon={Phone} label="WhatsApp" value={envio.whatsapp_destinatario} />
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin destinatario registrado</p>
                  )}
                </div>

                {/* Dirección de entrega específica */}
                {envio.direccion_entrega && (
                  <div className="p-4 border rounded-lg">
                    <p className="text-xs font-semibold text-muted-foreground mb-3">DIRECCIÓN DE ENTREGA</p>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-success mt-0.5" />
                      <div>
                        <p className="font-medium">{envio.direccion_entrega}</p>
                        <p className="text-sm text-muted-foreground">
                          {envio.ciudad_entrega} {envio.cp_entrega && `• CP: ${envio.cp_entrega}`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="financiero" className="space-y-4 mt-4">
                {/* Totales */}
                <div className="p-4 border rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground mb-3">INFORMACIÓN DE PAGO</p>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoRow 
                      icon={DollarSign} 
                      label="Precio Total" 
                      value={
                        <span className="text-lg font-bold text-primary">
                          ${envio.precio_total?.toLocaleString('es-AR') || '0'}
                        </span>
                      } 
                    />
                    <InfoRow 
                      icon={FileText} 
                      label="Tipo de Pago" 
                      value={TIPO_PAGO_LABELS[envio.tipo_pago || 'contado'] || envio.tipo_pago} 
                    />
                    {envio.valor_declarado && (
                      <InfoRow 
                        icon={DollarSign} 
                        label="Valor Declarado" 
                        value={`$${envio.valor_declarado.toLocaleString('es-AR')}`} 
                      />
                    )}
                    <InfoRow 
                      icon={Package} 
                      label="Pago Contra Entrega" 
                      value={envio.pago_contra_entrega ? 'Sí' : 'No'} 
                    />
                  </div>
                </div>

                {/* Detalles de conceptos */}
                {detalles && detalles.length > 0 && (
                  <div className="p-4 border rounded-lg">
                    <p className="text-xs font-semibold text-muted-foreground mb-3">DESGLOSE</p>
                    <div className="space-y-2">
                      {detalles.map((detalle) => (
                        <div key={detalle.id} className="flex justify-between items-center py-1 border-b last:border-0">
                          <span className="text-sm">{detalle.nombre_concepto}</span>
                          <span className="font-medium">${detalle.monto?.toLocaleString('es-AR') || '0'}</span>
                        </div>
                      ))}
                      <Separator />
                      <div className="flex justify-between items-center pt-2">
                        <span className="font-semibold">Total</span>
                        <span className="text-lg font-bold text-primary">
                          ${envio.precio_total?.toLocaleString('es-AR') || '0'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="evidencia" className="space-y-4 mt-4">
                {/* Estado de entrega */}
                {envio.fecha_entrega && (
                  <div className="p-4 border rounded-lg bg-green-500/10 border-green-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium text-green-700">Entregado</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(envio.fecha_entrega), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleDownloadEPOD}
                        disabled={isGeneratingEPOD}
                        className="ml-2"
                      >
                        {isGeneratingEPOD ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        Descargar EPOD
                      </Button>
                    </div>
                  </div>
                )}

                {/* Geolocalización de entrega */}
                {(envio as any).entrega_lat && (envio as any).entrega_lng && (
                  <div className="p-4 border rounded-lg bg-blue-500/10 border-blue-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-blue-700">Ubicación GPS de Entrega</p>
                          <p className="text-sm text-muted-foreground font-mono">
                            {(envio as any).entrega_lat.toFixed(6)}, {(envio as any).entrega_lng.toFixed(6)}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        asChild
                      >
                        <a 
                          href={`https://www.google.com/maps?q=${(envio as any).entrega_lat},${(envio as any).entrega_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          Ver en Mapa
                        </a>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Foto de entrega */}
                <div className="p-4 border rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    FOTO DE ENTREGA
                  </p>
                  {envio.foto_entrega ? (
                    <a 
                      href={envio.foto_entrega} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img 
                        src={envio.foto_entrega} 
                        alt="Foto de entrega"
                        className="rounded-lg max-h-64 w-full object-contain bg-muted hover:opacity-90 transition-opacity cursor-pointer"
                      />
                      <p className="text-xs text-center text-muted-foreground mt-2">
                        Click para ver en tamaño completo
                      </p>
                    </a>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <ImageOff className="h-12 w-12 mb-2 opacity-50" />
                      <p className="text-sm">Sin foto de entrega</p>
                    </div>
                  )}
                </div>

                {/* Firma del destinatario */}
                <div className="p-4 border rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <PenTool className="h-4 w-4" />
                    FIRMA DEL DESTINATARIO
                  </p>
                  {envio.firma_destinatario ? (
                    <a 
                      href={envio.firma_destinatario} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <div className="bg-white rounded-lg border p-4">
                        <img 
                          src={envio.firma_destinatario} 
                          alt="Firma del destinatario"
                          className="max-h-32 w-full object-contain"
                        />
                      </div>
                      <p className="text-xs text-center text-muted-foreground mt-2">
                        Click para ver en tamaño completo
                      </p>
                    </a>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <PenTool className="h-12 w-12 mb-2 opacity-50" />
                      <p className="text-sm">Sin firma registrada</p>
                    </div>
                  )}
                </div>

                {/* Incidentes */}
                <div className="p-4 border rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    INCIDENTES REPORTADOS
                  </p>
                  {incidentes && incidentes.length > 0 ? (
                    <div className="space-y-4">
                      {incidentes.map((incidente) => (
                        <div key={incidente.id} className="p-3 border rounded-lg bg-orange-500/5 border-orange-500/20">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500/20">
                                {incidente.tipo}
                              </Badge>
                              <Badge 
                                variant="outline" 
                                className={`ml-2 ${
                                  incidente.estado === 'resuelto' 
                                    ? 'bg-green-500/10 text-green-700 border-green-500/20'
                                    : 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20'
                                }`}
                              >
                                {incidente.estado}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(incidente.created_at), "d MMM yyyy", { locale: es })}
                            </span>
                          </div>
                          {incidente.descripcion && (
                            <p className="text-sm mb-2">{incidente.descripcion}</p>
                          )}
                          {incidente.resolucion && (
                            <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded mt-2">
                              <span className="font-medium">Resolución:</span> {incidente.resolucion}
                            </div>
                          )}
                          {incidente.foto_evidencia && (
                            <a 
                              href={incidente.foto_evidencia} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="block mt-3"
                            >
                              <img 
                                src={incidente.foto_evidencia} 
                                alt="Evidencia del incidente"
                                className="rounded-lg max-h-48 w-full object-contain bg-muted hover:opacity-90 transition-opacity cursor-pointer"
                              />
                              <p className="text-xs text-center text-muted-foreground mt-1">
                                Click para ver en tamaño completo
                              </p>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mb-2 opacity-50 text-green-500" />
                      <p className="text-sm">Sin incidentes reportados</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No se encontró el envío</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
