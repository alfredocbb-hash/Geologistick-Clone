import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Phone, MessageCircle, CheckCircle, Package, XCircle, Clock, MapPin, Gauge, PauseCircle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DriverEnhancedData } from '@/hooks/useDriverRouteProgress';

interface DriverDetailPanelProps {
  open: boolean;
  onClose: () => void;
  driverId: string | null;
  driverName: string;
  driverLastName: string;
  updatedAt: string;
  activeRouteId: string | null;
  activeRouteNumber: string | null;
  enhancedData?: DriverEnhancedData;
}

interface StopDetail {
  envioId: string;
  trackingNumber: string;
  address: string;
  estado: string;
  orden: number;
  completadaAt: string | null;
}

export function DriverDetailPanel({
  open,
  onClose,
  driverId,
  driverName,
  driverLastName,
  updatedAt,
  activeRouteId,
  activeRouteNumber,
  enhancedData,
}: DriverDetailPanelProps) {
  // Fetch detailed stops for the active route
  const { data: stops = [] } = useQuery<StopDetail[]>({
    queryKey: ['driver-route-stops', activeRouteId],
    queryFn: async () => {
      if (!activeRouteId) return [];

      const { data: paradas } = await supabase
        .from('ruta_paradas')
        .select('envio_id, orden, estado, completada_at')
        .eq('ruta_id', activeRouteId)
        .order('orden');

      if (!paradas || paradas.length === 0) return [];

      const envioIds = paradas.map(p => p.envio_id).filter(Boolean);
      if (envioIds.length === 0) return [];

      const { data: envios } = await supabase
        .from('envios')
        .select('id, tracking_number, direccion_entrega')
        .in('id', envioIds);

      return paradas.map(p => {
        const envio = envios?.find(e => e.id === p.envio_id);
        return {
          envioId: p.envio_id || '',
          trackingNumber: envio?.tracking_number || '—',
          address: envio?.direccion_entrega || '—',
          estado: p.estado || 'pendiente',
          orden: p.orden || 0,
          completadaAt: p.completada_at,
        };
      });
    },
    enabled: open && !!activeRouteId,
  });

  const progress = enhancedData?.routeProgress;
  const initials = `${(driverName || 'C')[0]}${(driverLastName || '')[0] || ''}`.toUpperCase();

  const getStopIcon = (estado: string) => {
    switch (estado) {
      case 'completada': return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
      case 'fallida': return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
      case 'reprogramado': return <Clock className="h-4 w-4 text-orange-500 shrink-0" />;
      default: return <Package className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[360px] sm:max-w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">Detalle del Chofer</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Profile */}
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14">
              {enhancedData?.avatarUrl && <AvatarImage src={enhancedData.avatarUrl} />}
              <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-lg">{driverName} {driverLastName}</h3>
              <p className="text-xs text-muted-foreground">
                Última señal: {formatDistanceToNow(new Date(updatedAt), { addSuffix: true, locale: es })}
              </p>
            </div>
          </div>

          {/* Contact buttons */}
          {enhancedData?.phone && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <a href={`tel:${enhancedData.phone}`}>
                  <Phone className="h-4 w-4 mr-2" />
                  Llamar
                </a>
              </Button>
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <a href={`https://wa.me/${enhancedData.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </a>
              </Button>
            </div>
          )}

          {/* Speed/Status */}
          <div className="flex gap-2">
            {enhancedData?.speed !== null && enhancedData?.speed !== undefined && (
              <Badge variant="outline" className="gap-1">
                {enhancedData.speed < 2 ? (
                  <><PauseCircle className="h-3 w-3" /> Detenido</>
                ) : (
                  <><Gauge className="h-3 w-3" /> {Math.round(enhancedData.speed)} km/h</>
                )}
              </Badge>
            )}
            {enhancedData && enhancedData.idleMinutes >= 10 && (enhancedData.speed ?? 0) < 2 && (
              <Badge variant="outline" className="gap-1 border-orange-500/30 text-orange-600 dark:text-orange-400">
                <Clock className="h-3 w-3" />
                Detenido {enhancedData.idleMinutes} min
              </Badge>
            )}
          </div>

          <Separator />

          {/* Route Progress */}
          {activeRouteId && activeRouteNumber && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">Ruta {activeRouteNumber}</h4>
                  {progress && <span className="text-sm font-semibold text-primary">{progress.percentage}%</span>}
                </div>
                {progress && progress.total > 0 && (
                  <>
                    <Progress value={progress.percentage} className="h-2.5 mb-2" />
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        {progress.completed} entregadas
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3 text-yellow-500" />
                        {progress.pending} pendientes
                      </span>
                      {progress.failed > 0 && (
                        <span className="flex items-center gap-1">
                          <XCircle className="h-3 w-3 text-red-500" />
                          {progress.failed} fallidas
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              <Separator />

              {/* Stops List */}
              <div>
                <h4 className="font-medium text-sm mb-3">Paradas ({stops.length})</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {stops.map((stop) => (
                    <div
                      key={stop.envioId}
                      className={`flex items-start gap-2.5 p-2 rounded-lg text-sm ${
                        stop.estado === 'completada' ? 'bg-green-500/5' :
                        stop.estado === 'fallida' ? 'bg-red-500/5' :
                        'bg-muted/30'
                      }`}
                    >
                      <div className="mt-0.5">{getStopIcon(stop.estado)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-xs">#{stop.orden} · {stop.trackingNumber}</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                            {stop.estado}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {stop.address}
                        </p>
                        {stop.completadaAt && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {format(new Date(stop.completadaAt), "HH:mm 'hs'", { locale: es })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {stops.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Sin paradas registradas</p>
                  )}
                </div>
              </div>
            </>
          )}

          {!activeRouteId && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Este chofer no tiene una ruta activa en este momento
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
