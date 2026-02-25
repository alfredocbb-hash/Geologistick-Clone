import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Loader2, 
  Navigation, 
  Phone,
  MessageCircle,
  AlertTriangle,
  CheckCircle,
  Package,
  Home,
  MapPin,
  Clock,
  Route,
  QrCode,
  X,
  List,
  Map as MapIcon,
  DollarSign,
  ChevronRight,
  CalendarClock,
  Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import QRScanner from '@/components/qr/QRScanner';
import PickupConfirmation from '@/components/scan/PickupConfirmation';
import DeliveryConfirmation from '@/components/delivery/DeliveryConfirmation';
import ReportIncidentDialog from '@/components/incidents/ReportIncidentDialog';
import RescheduleDialog from '@/components/driver/RescheduleDialog';
import { MapView, type MarkerInfo } from '@/components/maps';

type ViewMode = 'list' | 'map';

export default function ActiveRouteNavigation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get('id');
  const routeType = searchParams.get('type') || 'hoja'; // 'hoja' or 'planificada'
  
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<any>(null);
  const [dialogType, setDialogType] = useState<'pickup' | 'delivery' | 'incident' | 'reschedule' | null>(null);

  const DIALOG_STATE_KEY = 'active-route-dialog-state';

  // Helper to open a dialog and persist state to sessionStorage (survives Android WebView reload)
  const openDialog = useCallback((shipment: any, type: 'pickup' | 'delivery' | 'incident' | 'reschedule') => {
    setSelectedShipment(shipment);
    setDialogType(type);
    try {
      sessionStorage.setItem(DIALOG_STATE_KEY, JSON.stringify({ shipment, dialogType: type }));
    } catch (e) {
      console.warn('Could not persist dialog state:', e);
    }
  }, []);

  // Helper to close dialog and clean up sessionStorage
  const closeDialog = useCallback(() => {
    setSelectedShipment(null);
    setDialogType(null);
    sessionStorage.removeItem(DIALOG_STATE_KEY);
  }, []);

  // Restore dialog state after Android WebView reload
  useEffect(() => {
    const saved = sessionStorage.getItem(DIALOG_STATE_KEY);
    if (saved) {
      try {
        const { shipment, dialogType: savedType } = JSON.parse(saved);
        if (shipment && savedType) {
          setSelectedShipment(shipment);
          setDialogType(savedType);
        }
      } catch (e) {
        console.error('Error restoring dialog state:', e);
        sessionStorage.removeItem(DIALOG_STATE_KEY);
      }
    }
  }, []);

  const isPlannedRoute = routeType === 'planificada';

  // Enable geolocation tracking with route context
  const { location, isTracking } = useGeolocation({ 
    enabled: !!routeId,
    updateInterval: 30000,
    activeRouteId: isPlannedRoute ? routeId : null,
    activeHojaRutaId: !isPlannedRoute ? routeId : null,
  });

  // Fetch hoja de ruta
  const { data: hojaRuta, isLoading: loadingHoja } = useQuery({
    queryKey: ['my-active-route-hoja', routeId],
    queryFn: async () => {
      if (!routeId) return null;
      
      const { data, error } = await supabase
        .from('hojas_ruta')
        .select(`
          *,
          sucursal_origen:sucursales!hojas_ruta_sucursal_origen_id_fkey(nombre, codigo),
          sucursal_destino:sucursales!hojas_ruta_sucursal_destino_id_fkey(nombre, codigo),
          vehiculo:vehiculos(patente, marca, modelo)
        `)
        .eq('id', routeId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!routeId && !isPlannedRoute,
    refetchInterval: 60000,
  });

  // Fetch ruta planificada
  const { data: rutaPlanificada, isLoading: loadingRuta } = useQuery({
    queryKey: ['my-active-route-planificada', routeId],
    queryFn: async () => {
      if (!routeId) return null;
      
      const { data, error } = await supabase
        .from('rutas_planificadas')
        .select(`
          *,
          vehiculo:vehiculos(patente, marca, modelo),
          sucursal:sucursales(nombre, codigo)
        `)
        .eq('id', routeId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!routeId && isPlannedRoute,
    refetchInterval: 60000,
  });

  // Fetch envíos de la hoja de ruta
  const { data: enviosHoja = [], isLoading: loadingEnviosHoja } = useQuery({
    queryKey: ['my-active-route-envios-hoja', routeId],
    queryFn: async () => {
      if (!routeId) return [];
      
      const { data, error } = await supabase
        .from('hoja_ruta_envios')
        .select(`
          *,
          envio:envios(
            id,
            tracking_number,
            estado,
            estado_retiro,
            requiere_retiro,
            pago_contra_entrega,
            precio_total,
            tipo_pago,
            chofer_id,
            direccion_retiro,
            ciudad_retiro,
            direccion_entrega,
            ciudad_entrega,
            entrega_lat,
            entrega_lng,
            remitente_lat,
            remitente_lng,
            notas,
            nombre_destinatario,
            nombre_remitente,
            whatsapp_destinatario,
            destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, telefono, direccion, ciudad),
            remitente:clientes!envios_remitente_id_fkey(nombre, apellido, telefono, direccion, ciudad)
          )
        `)
        .eq('hoja_ruta_id', routeId)
        .order('orden');

      if (error) throw error;
      return data;
    },
    enabled: !!routeId && !isPlannedRoute,
  });

  // Fetch paradas de la ruta planificada
  const { data: paradasRuta = [], isLoading: loadingParadas } = useQuery({
    queryKey: ['my-active-route-paradas', routeId],
    queryFn: async () => {
      if (!routeId) return [];
      
      const { data, error } = await supabase
        .from('ruta_paradas')
        .select(`
          *,
          envio:envios(
            id,
            tracking_number,
            estado,
            estado_retiro,
            requiere_retiro,
            pago_contra_entrega,
            precio_total,
            tipo_pago,
            chofer_id,
            direccion_retiro,
            ciudad_retiro,
            direccion_entrega,
            ciudad_entrega,
            entrega_lat,
            entrega_lng,
            remitente_lat,
            remitente_lng,
            notas,
            nombre_destinatario,
            nombre_remitente,
            whatsapp_destinatario,
            destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, telefono, direccion, ciudad),
            remitente:clientes!envios_remitente_id_fkey(nombre, apellido, telefono, direccion, ciudad)
          )
        `)
        .eq('ruta_id', routeId)
        .order('orden');

      if (error) throw error;
      return data;
    },
    enabled: !!routeId && isPlannedRoute,
  });

  // Unified data
  const routeData = isPlannedRoute ? rutaPlanificada : hojaRuta;
  const routeNumber = isPlannedRoute ? rutaPlanificada?.numero : hojaRuta?.numero;
  const allEnvios = isPlannedRoute 
    ? paradasRuta.map(p => ({
        ...p,
        envio: p.envio ? {
          ...p.envio,
          requiere_retiro: p.tipo === 'retiro'
        } : null,
        _isSucursalStop: !p.envio_id && !!p.sucursal_id,
      }))
    : enviosHoja;

  // Filter out shipments that have been unassigned (e.g. rescheduled: chofer_id = NULL)
  const envios = allEnvios.filter(item => {
    // Sucursal stops always show
    if ((item as any)._isSucursalStop) return true;
    
    const envio = item.envio;
    if (!envio) return false;
    // Excluir paradas marcadas como reprogramadas en ruta_paradas
    if (item.estado === 'reprogramado') return false;
    // Para rutas planificadas: solo mostrar envios asignados a este chofer
    // Los reprogramados tienen chofer_id = NULL y se excluyen
    if (isPlannedRoute) {
      return envio.chofer_id === user?.id;
    }
    // Para hojas de ruta: la asociacion es via hoja_ruta_envios,
    // excluir solo si chofer_id fue reasignado a otro usuario
    return !envio.chofer_id || envio.chofer_id === user?.id;
  });

  // Calculate stats - incidencia counts as "completed" for driver (no further action needed)
  const stats = useMemo(() => {
    const total = envios.length;
    const completed = envios.filter(e => {
      if ((e as any)._isSucursalStop) return e.estado === 'completada';
      return e.envio?.estado === 'entregado' || 
        e.envio?.estado === 'devuelto' ||
        e.envio?.estado === 'incidencia' ||
        e.envio?.estado_retiro === 'retirado';
    }).length;
    const failed = envios.filter(e => {
      if ((e as any)._isSucursalStop) return false;
      return e.envio?.estado === 'devuelto' ||
        e.envio?.estado === 'incidencia' ||
        e.envio?.estado_retiro === 'fallido';
    }).length;
    const pending = total - completed;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    
    return { total, completed, failed, pending, progress };
  }, [envios]);

  // Get next stop - skip shipments with incident (no further driver action)
  const nextStop = useMemo(() => {
    return envios.find(e => {
      // Sucursal stop: pending if not completada
      if ((e as any)._isSucursalStop) return e.estado !== 'completada';
      
      const envio = e.envio;
      if (!envio) return false;
      
      // Skip shipments with incident - no further action needed from driver
      if (envio.estado === 'incidencia') return false;
      
      // Excluir envíos sin chofer asignado (reprogramados que pasaron el filtro)
      if (!envio.chofer_id) return false;
      
      const isPickupStop = envio.requiere_retiro;
      
      if (isPickupStop) {
        // Retiro completado si estado_retiro es 'retirado'/'fallido' O estado es 'recogido'
        const pickupCompleted = envio.estado_retiro === 'retirado' || 
                                envio.estado_retiro === 'fallido' ||
                                envio.estado === 'recogido';
        return !pickupCompleted;
      }
      
      // Entrega: verificar estado
      return envio.estado !== 'entregado' && envio.estado !== 'devuelto';
    });
  }, [envios]);

  // Build markers for map view
  const mapMarkers: MarkerInfo[] = useMemo(() => {
    return envios
      .map((item, index) => {
        const envio = item.envio;
        if (!envio) return null;
        
        const isItemPickup = envio.requiere_retiro;
        const isCompleted = envio.estado === 'entregado' || envio.estado === 'devuelto' || envio.estado === 'incidencia' || envio.estado_retiro === 'retirado';
        const isCurrent = nextStop?.id === item.id;
        
        // Get coordinates: prioritize envio fields, fallback to ruta_paradas lat/lng
        const lat = isItemPickup 
          ? ((envio as any).remitente_lat || (item as any).lat)
          : ((envio as any).entrega_lat || (item as any).lat);
        const lng = isItemPickup 
          ? ((envio as any).remitente_lng || (item as any).lng)
          : ((envio as any).entrega_lng || (item as any).lng);
        
        // Skip if no coordinates
        if (!lat || !lng) return null;
        
        const contact = isItemPickup ? envio.remitente : envio.destinatario;
        const name = isItemPickup 
          ? (envio.nombre_remitente || `${contact?.nombre || ''} ${contact?.apellido || ''}`.trim())
          : (envio.nombre_destinatario || `${contact?.nombre || ''} ${contact?.apellido || ''}`.trim());
        
        // Use icon based on status
        const icon = isCompleted ? 'destination' as const : isCurrent ? 'current' as const : 'origin' as const;
        
        return {
          id: item.id,
          position: { lat, lng },
          title: `#${index + 1} - ${name || 'Sin nombre'}`,
          icon,
          type: 'envio' as const,
          data: { 
            address: isItemPickup 
              ? (envio.direccion_retiro || contact?.direccion || '')
              : (envio.direccion_entrega || contact?.direccion || ''),
            isPickup: isItemPickup,
            isCompleted,
            isCurrent
          },
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null) as MarkerInfo[];
  }, [envios, nextStop]);

  // Close route mutation
  const closeRouteMutation = useMutation({
    mutationFn: async () => {
      if (!routeId) throw new Error('No hay ruta activa');

      if (isPlannedRoute) {
        const { data, error } = await supabase.rpc('close_ruta_planificada', { p_ruta_id: routeId });
        if (error) throw error;
        const result = data as { success: boolean; error?: string; message?: string } | null;
        if (result && !result.success) {
          throw new Error(result.error || 'Error al cerrar ruta');
        }
      } else {
        const { data, error } = await supabase.rpc('close_hoja_ruta', { p_hoja_id: routeId });
        if (error) throw error;
        const result = data as { success: boolean; error?: string; message?: string } | null;
        if (result && !result.success) {
          throw new Error(result.error || 'Error al cerrar hoja de ruta');
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-hojas-ruta'] });
      queryClient.invalidateQueries({ queryKey: ['my-rutas-planificadas'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-rutas-planificadas'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-hojas-ruta'] });
      toast.success('¡Ruta completada!');
      navigate('/my-routes');
    },
    onError: (error) => {
      // If the route is already closed/completed, treat as success
      if (error.message?.includes('Solo se pueden cerrar')) {
        queryClient.invalidateQueries({ queryKey: ['mobile-rutas-planificadas'] });
        queryClient.invalidateQueries({ queryKey: ['mobile-hojas-ruta'] });
        toast.success('La ruta ya fue completada');
        navigate('/my-routes');
      } else {
        toast.error('Error al cerrar ruta: ' + error.message);
      }
    }
  });

  // Navigate to address with Google Maps
  const navigateToAddress = useCallback((address: string, city?: string) => {
    const fullAddress = city ? `${address}, ${city}` : address;
    const encodedAddress = encodeURIComponent(fullAddress);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`, '_blank');
  }, []);

  // Navigate full route
  const navigateFullRoute = useCallback(() => {
    const pendingStops = envios
      .filter(e => {
        const envio = e.envio;
        if (!envio) return false;
        if (envio.requiere_retiro) return envio.estado_retiro !== 'retirado';
        return envio.estado !== 'entregado' && envio.estado !== 'devuelto' && envio.estado !== 'incidencia';
      })
      .map(e => {
        const envio = e.envio;
        if (envio?.requiere_retiro) {
          return `${envio.direccion_retiro || ''}, ${envio.ciudad_retiro || ''}`.trim();
        }
        return `${envio?.direccion_entrega || envio?.destinatario?.direccion || ''}, ${envio?.ciudad_entrega || envio?.destinatario?.ciudad || ''}`.trim();
      })
      .filter(addr => addr && addr.length > 5 && addr !== ','); // Filter empty/invalid addresses

    if (pendingStops.length === 0) {
      toast.info('No hay paradas pendientes');
      return;
    }

    // Google Maps URL API only supports up to 10 waypoints
    if (pendingStops.length > 10) {
      toast.warning(`Mostrando las primeras 10 de ${pendingStops.length} paradas`);
    }

    const limitedStops = pendingStops.slice(0, 10);
    const destination = encodeURIComponent(limitedStops[limitedStops.length - 1]);
    
    if (limitedStops.length > 1) {
      const waypoints = limitedStops
        .slice(0, -1)
        .map(addr => encodeURIComponent(addr))
        .join('|');
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}&waypoints=${waypoints}&travelmode=driving`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`, '_blank');
    }
  }, [envios]);

  // Handle QR scan
  const handleQRScan = useCallback(async (data: string) => {
    setShowQRScanner(false);
    
    // Search for shipment by tracking number
    const { data: envio, error } = await supabase
      .from('envios')
      .select(`
        id,
        tracking_number,
        estado,
        estado_retiro,
        requiere_retiro,
        direccion_retiro,
        ciudad_retiro,
        remitente:clientes!envios_remitente_id_fkey(nombre, apellido, telefono)
      `)
      .ilike('tracking_number', data)
      .single();

    if (error || !envio) {
      toast.error('Envío no encontrado');
      return;
    }

    // Play beep sound
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1f');
    audio.play().catch(() => {});

    openDialog(envio, 'pickup');
  }, [openDialog]);

  // Call customer
  const callCustomer = useCallback((phone: string) => {
    window.open(`tel:${phone}`, '_self');
  }, []);

  // WhatsApp customer
  const whatsAppCustomer = useCallback((phone: string, name: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Hola ${name}, soy el repartidor. Estoy llegando con su envío.`);
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  }, []);

  const isLoading = isPlannedRoute ? (loadingRuta || loadingParadas) : (loadingHoja || loadingEnviosHoja);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!routeData) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Route className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Ruta no encontrada</h2>
        <Button onClick={() => navigate('/my-routes')} className="mt-4">
          Volver a Mis Rutas
        </Button>
      </div>
    );
  }

  const isSucursalStop = (nextStop as any)?._isSucursalStop;
  const nextEnvio = isSucursalStop ? null : nextStop?.envio;
  const isPickup = nextEnvio?.requiere_retiro;
  const contact = isPickup ? nextEnvio?.remitente : nextEnvio?.destinatario;
  const city = isSucursalStop 
    ? '' 
    : (isPickup ? nextEnvio?.ciudad_retiro : (nextEnvio?.ciudad_entrega || contact?.ciudad));
  const address = isSucursalStop 
    ? ((nextStop as any)?.direccion || '')
    : (isPickup 
      ? `${nextEnvio?.direccion_retiro}`
      : `${nextEnvio?.direccion_entrega || contact?.direccion}`);
  
  // Phone fallback: use linked client's phone OR direct whatsapp_destinatario field
  const phone = isSucursalStop ? null : (isPickup 
    ? contact?.telefono 
    : (contact?.telefono || (nextEnvio as any)?.whatsapp_destinatario));
  const clienteName = isSucursalStop 
    ? ((nextStop as any)?.nombre_parada || 'Sucursal')
    : (isPickup 
      ? (nextEnvio?.nombre_remitente || `${contact?.nombre || ''} ${contact?.apellido || ''}`.trim())
      : (nextEnvio?.nombre_destinatario || `${contact?.nombre || ''} ${contact?.apellido || ''}`.trim()));

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/my-routes')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">{routeNumber}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{format(new Date(), 'dd/MM', { locale: es })}</span>
                <span>•</span>
                <span>{Math.round(stats.progress)}% completado</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={navigateFullRoute}>
              <Route className="h-4 w-4 mr-1" />
              Ruta
            </Button>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => closeRouteMutation.mutate()}
              disabled={closeRouteMutation.isPending}
            >
              {closeRouteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        {/* Progress bar */}
        <Progress value={stats.progress} className="h-1" />
      </div>

      {/* View Toggle */}
      <div className="p-4">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Lista
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center gap-2">
              <MapIcon className="h-4 w-4" />
              Mapa
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stats Cards */}
      <div className="px-4 grid grid-cols-3 gap-2 mb-4">
        <Card className="bg-muted/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pendientes</p>
          </CardContent>
        </Card>
        <Card className="bg-success/10 border-success/30">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-success">{stats.completed}</p>
            <p className="text-xs text-muted-foreground">Completados</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/30">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
            <p className="text-xs text-muted-foreground">Fallidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Next Stop Card */}
      {(nextEnvio || isSucursalStop) && (
        <div className="px-4 mb-4">
          <Card className="border-2 border-primary">
            <CardContent className="p-4">
              {/* Stop Type Badge */}
              <div className="flex items-center justify-between mb-3">
                <Badge className={isSucursalStop ? 'bg-accent' : isPickup ? 'bg-chofer' : 'bg-primary'}>
                  {isSucursalStop ? (
                    <>
                      <Building2 className="h-3 w-3 mr-1" />
                      PRÓXIMA SUCURSAL
                    </>
                  ) : isPickup ? (
                    <>
                      <Home className="h-3 w-3 mr-1" />
                      PRÓXIMO RETIRO
                    </>
                  ) : (
                    <>
                      <Package className="h-3 w-3 mr-1" />
                      PRÓXIMA ENTREGA
                    </>
                  )}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Parada {envios.findIndex(e => e.id === nextStop?.id) + 1}/{envios.length}
                </span>
              </div>

              {/* ETA */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <Clock className="h-4 w-4" />
                <span>ETA: ~10 min</span>
                <span>•</span>
                <span>2.5 km</span>
              </div>

              {/* Customer Info */}
              <div className="mb-3">
                <p className="font-semibold text-lg">
                  {isPickup 
                    ? (nextEnvio.nombre_remitente || `${contact?.nombre || ''} ${contact?.apellido || ''}`.trim())
                    : (nextEnvio.nombre_destinatario || `${contact?.nombre || ''} ${contact?.apellido || ''}`.trim())
                  }
                </p>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                  <span className="text-sm">{address}{city ? `, ${city}` : ''}</span>
                </div>
              </div>

              {/* COD Badge */}
              {nextEnvio.pago_contra_entrega && (
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-3 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-warning" />
                  <div>
                    <p className="font-medium text-warning">COBRAR EN DESTINO</p>
                    <p className="text-lg font-bold">${nextEnvio.precio_total?.toFixed(2)}</p>
                  </div>
                </div>
              )}

              {/* Notes */}
              {nextEnvio.notas && (
                <div className="bg-muted/50 rounded-lg p-3 mb-3 text-sm">
                  <span className="font-medium">Notas:</span> {nextEnvio.notas}
                </div>
              )}

              {/* Action Buttons */}
              {isSucursalStop ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    className="bg-primary"
                    onClick={() => navigateToAddress(address)}
                  >
                    <Navigation className="h-4 w-4 mr-1" />
                    Navegar
                  </Button>
                  <Button 
                    className="bg-success hover:bg-success/90"
                    onClick={async () => {
                      const { error } = await supabase
                        .from('ruta_paradas')
                        .update({ estado: 'completada', completada_at: new Date().toISOString() })
                        .eq('id', nextStop?.id);
                      if (error) { toast.error('Error al completar parada'); return; }
                      toast.success('Parada completada');
                      queryClient.invalidateQueries({ queryKey: ['my-active-route-paradas'] });
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Llegué
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <Button 
                      className="bg-primary"
                      onClick={() => navigateToAddress(address)}
                    >
                      <Navigation className="h-4 w-4 mr-1" />
                      Navegar
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => phone && callCustomer(phone)}
                      disabled={!phone}
                    >
                      <Phone className="h-4 w-4 mr-1" />
                      Llamar
                    </Button>
                    <Button 
                      variant="outline"
                      className="bg-green-500/10 border-green-500/30 text-green-600"
                      onClick={() => phone && whatsAppCustomer(phone, clienteName)}
                      disabled={!phone}
                    >
                      <MessageCircle className="h-4 w-4 mr-1" />
                      WhatsApp
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button 
                      variant="outline"
                      className="border-destructive/30 text-destructive"
                      onClick={() => openDialog(nextEnvio, 'incident')}
                    >
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      Problema
                    </Button>
                    <Button 
                      variant="outline"
                      className="border-amber-500/30 text-amber-600"
                      onClick={() => openDialog(nextEnvio, 'reschedule')}
                    >
                      <CalendarClock className="h-4 w-4 mr-1" />
                      Reprogramar
                    </Button>
                    <Button 
                      className={isPickup ? 'bg-chofer hover:bg-chofer/90' : 'bg-success hover:bg-success/90'}
                      onClick={() => openDialog(nextEnvio, isPickup ? 'pickup' : 'delivery')}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      {isPickup ? 'Retiro OK' : 'Entrega OK'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* All Stops List or Map View */}
      {viewMode === 'list' ? (
        <div className="px-4 space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground mb-2">
            TODAS LAS PARADAS ({envios.length})
          </h3>
          
          {envios.map((item, index) => {
          const envio = item.envio;
          if (!envio) return null;
          
          const isItemPickup = envio.requiere_retiro;
          const isCompleted = envio.estado === 'entregado' || envio.estado === 'devuelto' || envio.estado === 'incidencia' || envio.estado_retiro === 'retirado';
          const isCurrent = nextStop?.id === item.id;
          const itemContact = isItemPickup ? envio.remitente : envio.destinatario;
          
          return (
            <Card 
              key={item.id} 
              className={`${isCurrent ? 'border-primary border-2' : ''} ${isCompleted ? 'opacity-60' : 'cursor-pointer hover:border-primary/50'}`}
              onClick={() => {
                if (!isCompleted) {
                  openDialog(envio, isItemPickup ? 'pickup' : 'delivery');
                }
              }}
            >
              <CardContent className="p-3 flex items-center gap-3">
                {/* Status Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  isCompleted 
                    ? 'bg-success text-success-foreground' 
                    : isItemPickup 
                      ? 'bg-chofer/20 text-chofer'
                      : 'bg-primary/20 text-primary'
                }`}>
                  {isCompleted ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : isItemPickup ? (
                    <Home className="h-4 w-4" />
                  ) : (
                    <Package className="h-4 w-4" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">#{index + 1}</span>
                    <span className="font-mono text-xs">{envio.tracking_number}</span>
                    {isCurrent && (
                      <Badge variant="outline" className="text-xs border-primary text-primary">
                        Sugerida
                      </Badge>
                    )}
                  </div>
                  <p className="font-medium truncate">
                    {isItemPickup 
                      ? (envio.nombre_remitente || `${itemContact?.nombre || ''} ${itemContact?.apellido || ''}`.trim())
                      : (envio.nombre_destinatario || `${itemContact?.nombre || ''} ${itemContact?.apellido || ''}`.trim())
                    }
                  </p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {isItemPickup 
                      ? (envio.direccion_retiro || itemContact?.direccion)
                      : (envio.direccion_entrega || itemContact?.direccion)
                    }
                    {(isItemPickup ? envio.ciudad_retiro : envio.ciudad_entrega) && 
                      `, ${isItemPickup ? envio.ciudad_retiro : envio.ciudad_entrega}`
                    }
                  </p>
                  {envio.pago_contra_entrega && !isCompleted && (
                    <Badge variant="outline" className="text-xs mt-1 border-warning text-warning">
                      COD: ${envio.precio_total}
                    </Badge>
                  )}
                </div>

                {/* Action Button */}
                {!isCompleted && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className={isItemPickup ? 'text-chofer hover:bg-chofer/10' : 'text-success hover:bg-success/10'}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDialog(envio, isItemPickup ? 'pickup' : 'delivery');
                    }}
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                )}

                {isCompleted && <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />}
              </CardContent>
            </Card>
          );
        })}
        </div>
      ) : (
        // Map View
        <div className="px-4">
          {mapMarkers.length > 0 ? (
            <MapView
              markers={mapMarkers}
              height="calc(100vh - 380px)"
              onMarkerClick={(marker) => {
                const item = envios.find(e => e.id === marker.id);
                if (item?.envio) {
                  const isItemPickup = item.envio.requiere_retiro;
                  const isCompleted = item.envio.estado === 'entregado' || 
                    item.envio.estado === 'devuelto' || 
                    item.envio.estado_retiro === 'retirado';
                  if (!isCompleted) {
                    openDialog(item.envio, isItemPickup ? 'pickup' : 'delivery');
                  }
                }
              }}
            />
          ) : (
            <Card className="p-8 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No hay coordenadas disponibles para mostrar el mapa
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Las direcciones serán geocodificadas al navegar
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Floating QR Button */}
      <Button
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-xl z-30"
        onClick={() => setShowQRScanner(true)}
      >
        <QrCode className="h-6 w-6" />
      </Button>

      {/* GPS Tracking Indicator */}
      {isTracking && (
        <div className="fixed bottom-20 left-4 bg-card rounded-full px-3 py-1 shadow-lg flex items-center gap-2 text-xs z-30">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          GPS activo
        </div>
      )}

      {/* QR Scanner */}
      {showQRScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowQRScanner(false)}
        />
      )}

      {/* Dialogs */}
      {selectedShipment && dialogType === 'pickup' && (
        <PickupConfirmation
          shipment={selectedShipment}
          onClose={closeDialog}
          onSuccess={() => {
            closeDialog();
            queryClient.invalidateQueries({ queryKey: ['my-active-route-paradas'] });
            queryClient.invalidateQueries({ queryKey: ['my-active-route-envios-hoja'] });
            queryClient.invalidateQueries({ queryKey: ['my-active-route-planificada'] });
            queryClient.invalidateQueries({ queryKey: ['my-active-route-hoja'] });
          }}
        />
      )}

      {selectedShipment && dialogType === 'delivery' && (
        <DeliveryConfirmation
          shipment={selectedShipment}
          onClose={closeDialog}
          onSuccess={() => {
            closeDialog();
            queryClient.invalidateQueries({ queryKey: ['my-active-route-paradas'] });
            queryClient.invalidateQueries({ queryKey: ['my-active-route-envios-hoja'] });
            queryClient.invalidateQueries({ queryKey: ['my-active-route-planificada'] });
            queryClient.invalidateQueries({ queryKey: ['my-active-route-hoja'] });
          }}
        />
      )}

      {selectedShipment && dialogType === 'incident' && (
        <ReportIncidentDialog
          shipment={selectedShipment}
          onClose={closeDialog}
          onSuccess={() => {
            closeDialog();
            queryClient.invalidateQueries({ queryKey: ['my-active-route-paradas'] });
            queryClient.invalidateQueries({ queryKey: ['my-active-route-envios-hoja'] });
            queryClient.invalidateQueries({ queryKey: ['my-active-route-planificada'] });
            queryClient.invalidateQueries({ queryKey: ['my-active-route-hoja'] });
          }}
        />
      )}

      {selectedShipment && dialogType === 'reschedule' && (
        <RescheduleDialog
          shipment={selectedShipment}
          onClose={closeDialog}
          onSuccess={() => {
            closeDialog();
            queryClient.invalidateQueries({ queryKey: ['my-active-route-paradas'] });
            queryClient.invalidateQueries({ queryKey: ['my-active-route-envios-hoja'] });
            queryClient.invalidateQueries({ queryKey: ['my-active-route-planificada'] });
            queryClient.invalidateQueries({ queryKey: ['my-active-route-hoja'] });
          }}
        />
      )}

      {/* Route Complete Modal */}
      {stats.pending === 0 && stats.total > 0 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 z-10"
              onClick={() => navigate('/my-routes')}
            >
              <X className="h-4 w-4" />
            </Button>
            <CardContent className="p-6 text-center">
              <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-10 w-10 text-success" />
              </div>
              
              <h3 className="text-2xl font-bold mb-2">¡Ruta Completada!</h3>
              
              <p className="text-muted-foreground mb-6">
                Has completado {stats.completed} de {stats.total} paradas
              </p>
              
              <div className="space-y-2">
                <Button
                  onClick={() => closeRouteMutation.mutate()}
                  disabled={closeRouteMutation.isPending}
                  className="w-full bg-success hover:bg-success/90"
                >
                  {closeRouteMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Cerrando...
                    </>
                  ) : (
                    'Cerrar Ruta'
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/my-routes')}
                >
                  Volver a Mis Rutas
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
