import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, MessageCircle, CheckCircle, Package, XCircle, Clock, MapPin, Gauge, PauseCircle, History } from 'lucide-react';
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
  onSelectRoute?: (driverId: string, rutaId: string) => void;
}

interface StopDetail {
  envioId: string;
  trackingNumber: string;
  address: string;
  estado: string;
  orden: number;
  completadaAt: string | null;
}

interface HistoricalRoute {
  id: string;
  numero: string;
  estado: string;
  fecha: string;
  tipo: 'ruta' | 'hoja';
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
  onSelectRoute,
}: DriverDetailPanelProps) {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(activeRouteId);
  const [selectedRouteType, setSelectedRouteType] = useState<'ruta' | 'hoja'>('ruta');

  // Reset selection when panel opens with new driver or active route changes
  useEffect(() => {
    if (open) {
      setSelectedRouteId(activeRouteId);
      setSelectedRouteType('ruta');
    }
  }, [open, activeRouteId]);

  // Fetch historical routes for this driver
  const { data: historicalRoutes = [] } = useQuery<HistoricalRoute[]>({
    queryKey: ['driver-historical-routes', driverId],
    queryFn: async () => {
      if (!driverId) return [];

      const [rutasRes, hojasRes] = await Promise.all([
        supabase
          .from('rutas_planificadas')
          .select('id, numero, estado, created_at')
          .eq('chofer_id', driverId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('hojas_ruta')
          .select('id, numero, estado, created_at')
          .eq('chofer_id', driverId)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      const rutas: HistoricalRoute[] = (rutasRes.data || []).map(r => ({
        id: r.id,
        numero: r.numero,
        estado: r.estado || 'pendiente',
        fecha: r.created_at || '',
        tipo: 'ruta' as const,
      }));

      const hojas: HistoricalRoute[] = (hojasRes.data || []).map(h => ({
        id: h.id,
        numero: h.numero,
        estado: h.estado || 'pendiente',
        fecha: h.created_at || '',
        tipo: 'hoja' as const,
      }));

      // Merge and sort by date desc
      return [...rutas, ...hojas].sort((a, b) =>
        new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );
    },
    enabled: open && !!driverId,
  });

  // Fetch stops for the selected route
  const { data: stops = [] } = useQuery<StopDetail[]>({
    queryKey: ['driver-route-stops', selectedRouteId, selectedRouteType],
    queryFn: async () => {
      if (!selectedRouteId) return [];

      if (selectedRouteType === 'ruta') {
        const { data: paradas } = await supabase
          .from('ruta_paradas')
          .select('envio_id, orden, estado, completada_at')
          .eq('ruta_id', selectedRouteId)
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
      } else {
        // Hoja de ruta stops
        const { data: hreEnvios } = await supabase
          .from('hoja_ruta_envios')
          .select('envio_id, orden, estado')
          .eq('hoja_ruta_id', selectedRouteId)
          .order('orden');

        if (!hreEnvios || hreEnvios.length === 0) return [];

        const envioIds = hreEnvios.map(h => h.envio_id).filter(Boolean);
        if (envioIds.length === 0) return [];

        const { data: envios } = await supabase
          .from('envios')
          .select('id, tracking_number, direccion_entrega')
          .in('id', envioIds);

        return hreEnvios.map(h => {
          const envio = envios?.find(e => e.id === h.envio_id);
          return {
            envioId: h.envio_id || '',
            trackingNumber: envio?.tracking_number || '—',
            address: envio?.direccion_entrega || '—',
            estado: h.estado || 'pendiente',
            orden: h.orden || 0,
            completadaAt: null,
          };
        });
      }
    },
    enabled: open && !!selectedRouteId,
  });

  const progress = enhancedData?.routeProgress;
  const initials = `${(driverName || 'C')[0]}${(driverLastName || '')[0] || ''}`.toUpperCase();
  const isViewingActiveRoute = selectedRouteId === activeRouteId;
  const selectedRoute = historicalRoutes.find(r => r.id === selectedRouteId);

  const handleRouteChange = (value: string) => {
    const route = historicalRoutes.find(r => r.id === value);
    if (route) {
      setSelectedRouteId(route.id);
      setSelectedRouteType(route.tipo);
      if (driverId && onSelectRoute) {
        onSelectRoute(driverId, route.id);
      }
    }
  };

  const getStopIcon = (estado: string) => {
    switch (estado) {
      case 'completada':
      case 'entregado':
      case 'recibido':
        return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
      case 'fallida':
      case 'fallido':
        return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
      case 'reprogramado':
        return <Clock className="h-4 w-4 text-orange-500 shrink-0" />;
      default:
        return <Package className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  const getEstadoBadgeClass = (estado: string) => {
    switch (estado) {
      case 'en_curso':
      case 'en_transito':
        return 'border-blue-500/30 text-blue-600 dark:text-blue-400';
      case 'completada':
      case 'recibida':
        return 'border-green-500/30 text-green-600 dark:text-green-400';
      case 'cancelada':
        return 'border-red-500/30 text-red-600 dark:text-red-400';
      default:
        return '';
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
                <a href={`https://wa.me/${(() => { const { formatArgentinaPhone } = require('@/components/ui/phone-input'); return formatArgentinaPhone(enhancedData.phone).replace(/\D/g, ''); })()}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </a>
              </Button>
            </div>
          )}

          {/* Speed/Status */}
          <div className="flex gap-2 flex-wrap">
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

          {/* Route Selector */}
          {historicalRoutes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium text-sm">Rutas del chofer</h4>
              </div>
              <Select value={selectedRouteId || ''} onValueChange={handleRouteChange}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Seleccionar ruta..." />
                </SelectTrigger>
                <SelectContent>
                  {historicalRoutes.map((route) => (
                    <SelectItem key={route.id} value={route.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{route.numero}</span>
                        <span className="text-muted-foreground text-xs">
                          {route.fecha ? format(new Date(route.fecha), 'dd/MM', { locale: es }) : ''}
                        </span>
                        <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${getEstadoBadgeClass(route.estado)}`}>
                          {route.estado}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Route Progress (only for active route) */}
          {isViewingActiveRoute && activeRouteId && activeRouteNumber && progress && progress.total > 0 && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">Progreso</h4>
                  <span className="text-sm font-semibold text-primary">{progress.percentage}%</span>
                </div>
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
              </div>
              <Separator />
            </>
          )}

          {/* Selected route info (non-active) */}
          {!isViewingActiveRoute && selectedRoute && (
            <>
              <div className="rounded-lg bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">{selectedRoute.numero}</h4>
                  <Badge variant="outline" className={`text-xs ${getEstadoBadgeClass(selectedRoute.estado)}`}>
                    {selectedRoute.estado}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedRoute.tipo === 'hoja' ? 'Hoja de ruta' : 'Ruta planificada'} · {selectedRoute.fecha ? format(new Date(selectedRoute.fecha), "dd/MM/yyyy HH:mm", { locale: es }) : ''}
                </p>
              </div>
              <Separator />
            </>
          )}

          {/* Stops List */}
          {selectedRouteId && (
            <div>
              <h4 className="font-medium text-sm mb-3">Paradas ({stops.length})</h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {stops.map((stop) => (
                  <div
                    key={stop.envioId}
                    className={`flex items-start gap-2.5 p-2 rounded-lg text-sm ${
                      ['completada', 'entregado', 'recibido'].includes(stop.estado) ? 'bg-green-500/5' :
                      ['fallida', 'fallido'].includes(stop.estado) ? 'bg-red-500/5' :
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
          )}

          {!selectedRouteId && historicalRoutes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Este chofer no tiene rutas registradas
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
