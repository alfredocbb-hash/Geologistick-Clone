import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  Package, 
  Truck, 
  CheckCircle, 
  AlertCircle, 
  Building2,
  User,
  MapPin,
  ArrowRight,
  CalendarClock,
  Route,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type ShipmentStatus = Database['public']['Enums']['shipment_status'];

interface ShipmentHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  envioId: string | null;
  trackingNumber: string;
}

const statusConfig: Record<ShipmentStatus, { label: string; color: string; icon: React.ElementType }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-500', icon: Clock },
  recogido: { label: 'Recogido', color: 'bg-blue-500', icon: Package },
  en_sucursal: { label: 'En Sucursal', color: 'bg-purple-500', icon: Building2 },
  en_bodega: { label: 'En Sucursal', color: 'bg-purple-500', icon: Building2 },
  en_transito: { label: 'En Tránsito', color: 'bg-blue-600', icon: Truck },
  en_reparto: { label: 'En Reparto', color: 'bg-orange-500', icon: Truck },
  entregado: { label: 'Entregado', color: 'bg-green-500', icon: CheckCircle },
  devuelto: { label: 'Devuelto', color: 'bg-red-500', icon: AlertCircle },
  cancelado: { label: 'Cancelado', color: 'bg-gray-500', icon: AlertCircle },
  incidencia: { label: 'Incidencia', color: 'bg-amber-500', icon: AlertCircle },
  no_entregado: { label: 'No Entregado', color: 'bg-red-600', icon: AlertCircle },
  primera_visita: { label: '1a Visita', color: 'bg-amber-600', icon: AlertCircle },
  segunda_visita: { label: '2a Visita', color: 'bg-red-400', icon: AlertCircle },
  reprogramado: { label: 'Reprogramado', color: 'bg-indigo-500', icon: CalendarClock },
};

interface HojaRutaInfo {
  numero: string;
  estado: string | null;
  sucursal_origen: { nombre: string } | null;
  sucursal_destino: { nombre: string } | null;
}

interface RutaInfo {
  numero: string;
  estado: string | null;
}

export function ShipmentHistoryDialog({ 
  open, 
  onOpenChange, 
  envioId, 
  trackingNumber 
}: ShipmentHistoryDialogProps) {
  const { data: historial, isLoading } = useQuery({
    queryKey: ['envio-historial', envioId],
    queryFn: async () => {
      if (!envioId) return [];
      
      const { data, error } = await supabase
        .from('envio_historial')
        .select('*')
        .eq('envio_id', envioId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const userIds = [...new Set(data?.map(h => h.created_by).filter(Boolean))];
      let profiles: Record<string, { nombre: string; apellido: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id, nombre, apellido')
          .in('user_id', userIds as string[]);
        
        profileData?.forEach(p => {
          profiles[p.user_id] = { nombre: p.nombre, apellido: p.apellido };
        });
      }
      
      return data?.map(h => ({
        ...h,
        profile: h.created_by ? profiles[h.created_by] : null
      })) || [];
    },
    enabled: open && !!envioId,
  });

  const { data: routeInfo } = useQuery({
    queryKey: ['envio-rutas', envioId],
    queryFn: async () => {
      if (!envioId) return { hojas: [], rutas: [] };

      const [hojasRes, rutasRes] = await Promise.all([
        supabase
          .from('hoja_ruta_envios')
          .select('hoja_ruta_id, hojas_ruta:hojas_ruta!hoja_ruta_envios_hoja_ruta_id_fkey(numero, estado, sucursal_origen:sucursales!hojas_ruta_sucursal_origen_id_fkey(nombre), sucursal_destino:sucursales!hojas_ruta_sucursal_destino_id_fkey(nombre))')
          .eq('envio_id', envioId),
        supabase
          .from('ruta_paradas')
          .select('ruta_id, rutas_planificadas:rutas_planificadas!ruta_paradas_ruta_id_fkey(numero, estado)')
          .eq('envio_id', envioId),
      ]);

      const hojas: HojaRutaInfo[] = (hojasRes.data || [])
        .map((h: any) => h.hojas_ruta)
        .filter(Boolean);

      // Deduplicate rutas by numero
      const rutasMap = new Map<string, RutaInfo>();
      (rutasRes.data || []).forEach((r: any) => {
        if (r.rutas_planificadas?.numero) {
          rutasMap.set(r.rutas_planificadas.numero, r.rutas_planificadas);
        }
      });

      return { hojas, rutas: Array.from(rutasMap.values()) };
    },
    enabled: open && !!envioId,
  });

  const StatusIcon = ({ status }: { status: ShipmentStatus }) => {
    const config = statusConfig[status];
    const Icon = config?.icon || Clock;
    return (
      <div className={`${config?.color || 'bg-gray-500'} p-2 rounded-full text-white`}>
        <Icon className="h-4 w-4" />
      </div>
    );
  };

  const hojas = routeInfo?.hojas || [];
  const rutas = routeInfo?.rutas || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Historial del Envío
          </DialogTitle>
          <p className="text-sm text-muted-foreground font-mono">
            {trackingNumber}
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {/* Associated routes section */}
          {(hojas.length > 0 || rutas.length > 0) && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Rutas asociadas
              </p>
              {hojas.map((h, i) => (
                <div key={`hoja-${i}`} className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg px-3 py-2">
                  <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-mono text-xs font-medium">{h.numero}</span>
                  <span className="text-muted-foreground text-xs truncate">
                    {h.sucursal_origen?.nombre || '?'} → {h.sucursal_destino?.nombre || '?'}
                  </span>
                  <Badge variant="outline" className="text-xs ml-auto shrink-0">{h.estado}</Badge>
                </div>
              ))}
              {rutas.map((r, i) => (
                <div key={`ruta-${i}`} className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg px-3 py-2">
                  <Route className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-mono text-xs font-medium">{r.numero}</span>
                  <span className="text-muted-foreground text-xs">Ruta de reparto</span>
                  <Badge variant="outline" className="text-xs ml-auto shrink-0">{r.estado}</Badge>
                </div>
              ))}
              <Separator />
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : historial && historial.length > 0 ? (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
              
              <div className="space-y-6">
                {historial.map((entry) => (
                  <div key={entry.id} className="relative flex gap-4">
                    <div className="z-10">
                      <StatusIcon status={entry.estado_nuevo as ShipmentStatus} />
                    </div>
                    
                    <div className="flex-1 pb-6">
                      <div className="bg-muted/50 rounded-lg p-4">
                        {entry.notas ? (
                          <p className="font-medium text-sm mb-2">{entry.notas}</p>
                        ) : (
                          <div className="flex items-center gap-2 mb-2">
                            {entry.estado_anterior && (
                              <>
                                <Badge variant="outline" className="text-xs">
                                  {statusConfig[entry.estado_anterior as ShipmentStatus]?.label || entry.estado_anterior}
                                </Badge>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              </>
                            )}
                            <Badge className={`${statusConfig[entry.estado_nuevo as ShipmentStatus]?.color} text-white`}>
                              {statusConfig[entry.estado_nuevo as ShipmentStatus]?.label || entry.estado_nuevo}
                            </Badge>
                          </div>
                        )}
                        
                        {entry.notas && (
                          <Badge variant="outline" className="text-xs mb-2">
                            {statusConfig[entry.estado_nuevo as ShipmentStatus]?.label || entry.estado_nuevo}
                          </Badge>
                        )}
                        
                        <p className="text-xs text-muted-foreground mb-2">
                          {entry.created_at && format(new Date(entry.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                        </p>
                        
                        {entry.profile && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                            <User className="h-3 w-3" />
                            <span>{entry.profile.nombre} {entry.profile.apellido || ''}</span>
                          </div>
                        )}

                        {entry.ubicacion && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{entry.ubicacion}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay historial disponible</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
