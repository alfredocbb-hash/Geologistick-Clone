import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Loader2, 
  Truck, 
  Package, 
  Home, 
  MapPin, 
  Clock,
  Route,
  Calendar,
  Navigation,
  Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function RouteStart() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get('id');
  const routeType = searchParams.get('type') || 'hoja'; // 'hoja' or 'planificada'
  
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [slideProgress, setSlideProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const isPlannedRoute = routeType === 'planificada';
  
  // Check if route is already started and redirect
  const routeStatus = isPlannedRoute 
    ? (useQuery({
        queryKey: ['ruta-planificada-start', routeId],
        enabled: false // will be fetched by the main query
      }).data as any)?.estado
    : (useQuery({
        queryKey: ['hoja-ruta-start', routeId],
        enabled: false // will be fetched by the main query
      }).data as any)?.estado;

  // Fetch hoja de ruta (for inter-branch transfers)
  const { data: hojaRuta, isLoading: loadingHoja } = useQuery({
    queryKey: ['hoja-ruta-start', routeId],
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
  });

  // Fetch ruta planificada (for delivery routes with stops)
  const { data: rutaPlanificada, isLoading: loadingRuta } = useQuery({
    queryKey: ['ruta-planificada-start', routeId],
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
  });

  // Fetch envíos de la hoja de ruta
  const { data: envios = [], isLoading: loadingEnvios } = useQuery({
    queryKey: ['hoja-ruta-envios-start', routeId],
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
            requiere_retiro,
            pago_contra_entrega,
            precio_total,
            direccion_retiro,
            direccion_entrega,
            destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido),
            remitente:clientes!envios_remitente_id_fkey(nombre, apellido)
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
  const { data: paradas = [], isLoading: loadingParadas } = useQuery({
    queryKey: ['ruta-planificada-paradas-start', routeId],
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
            requiere_retiro,
            pago_contra_entrega,
            precio_total,
            direccion_retiro,
            direccion_entrega,
            destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido),
            remitente:clientes!envios_remitente_id_fkey(nombre, apellido)
          )
        `)
        .eq('ruta_id', routeId)
        .order('orden');

      if (error) throw error;
      return data;
    },
    enabled: !!routeId && isPlannedRoute,
  });

  // Start route mutation for Hoja de Ruta using RPC
  const startHojaRouteMutation = useMutation({
    mutationFn: async () => {
      if (!routeId) throw new Error('Datos incompletos');

      const { data, error } = await supabase.rpc('start_hoja_ruta', {
        p_hoja_id: routeId
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; message?: string; already_started?: boolean };
      
      if (!result.success) {
        throw new Error(result.error || 'Error al iniciar la ruta');
      }
      
      return { routeId, alreadyStarted: result.already_started };
    },
    onSuccess: ({ routeId: returnedId, alreadyStarted }) => {
      queryClient.invalidateQueries({ queryKey: ['my-hojas-ruta'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-route-hoja', returnedId] });
      queryClient.invalidateQueries({ queryKey: ['my-active-route-envios-hoja', returnedId] });
      queryClient.invalidateQueries({ queryKey: ['hoja-ruta-start', returnedId] });
      
      if (alreadyStarted) {
        toast.info('La ruta ya estaba iniciada, continuando...');
      } else {
        toast.success('¡Ruta iniciada!');
      }
      navigate(`/active-route?id=${returnedId}&type=hoja`);
    },
    onError: (error) => {
      console.error('Error al iniciar ruta:', error);
      toast.error(error instanceof Error ? error.message : 'Error al iniciar la ruta');
    }
  });

  // Start route mutation for Ruta Planificada using RPC
  const startRutaPlanificadaMutation = useMutation({
    mutationFn: async () => {
      if (!routeId) throw new Error('Datos incompletos');

      const { data, error } = await supabase.rpc('start_ruta_planificada', {
        p_ruta_id: routeId
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; message?: string; already_started?: boolean };
      
      if (!result.success) {
        throw new Error(result.error || 'Error al iniciar la ruta');
      }
      
      return { routeId, alreadyStarted: result.already_started };
    },
    onSuccess: ({ routeId: returnedId, alreadyStarted }) => {
      queryClient.invalidateQueries({ queryKey: ['my-rutas-planificadas'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-route-planificada', returnedId] });
      queryClient.invalidateQueries({ queryKey: ['my-active-route-paradas', returnedId] });
      queryClient.invalidateQueries({ queryKey: ['ruta-planificada-start', returnedId] });
      
      if (alreadyStarted) {
        toast.info('La ruta ya estaba iniciada, continuando...');
      } else {
        toast.success('¡Ruta de reparto iniciada!');
      }
      navigate(`/active-route?id=${returnedId}&type=planificada`);
    },
    onError: (error) => {
      console.error('Error al iniciar ruta:', error);
      toast.error(error instanceof Error ? error.message : 'Error al iniciar la ruta');
    }
  });

  const startRouteMutation = isPlannedRoute ? startRutaPlanificadaMutation : startHojaRouteMutation;

  // Slide handlers
  const handleSlideStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleSlideMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const progress = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    
    setSlideProgress(progress);

    if (progress > 85) {
      setIsDragging(false);
      setShowConfirmation(true);
    }
  }, [isDragging]);

  const handleSlideEnd = useCallback(() => {
    if (slideProgress < 85) {
      setSlideProgress(0);
    }
    setIsDragging(false);
  }, [slideProgress]);

  const isLoading = isPlannedRoute ? (loadingRuta || loadingParadas) : (loadingHoja || loadingEnvios);
  const routeData = isPlannedRoute ? rutaPlanificada : hojaRuta;
  
  // Determine if route is already in progress
  const isRouteAlreadyStarted = isPlannedRoute 
    ? rutaPlanificada?.estado === 'en_curso'
    : hojaRuta?.estado === 'en_transito';

  // Auto-redirect if route is already started
  useEffect(() => {
    if (routeData && isRouteAlreadyStarted) {
      navigate(`/active-route?id=${routeId}&type=${routeType}`, { replace: true });
    }
  }, [routeData, isRouteAlreadyStarted, routeId, routeType, navigate]);

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
  
  // If route is already started, show continue button instead of slider
  if (isRouteAlreadyStarted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Navigation className="h-16 w-16 text-primary mb-4 animate-pulse" />
        <h2 className="text-xl font-semibold mb-2">Ruta en curso</h2>
        <p className="text-muted-foreground mb-4">Redirigiendo a la navegación...</p>
        <Button 
          onClick={() => navigate(`/active-route?id=${routeId}&type=${routeType}`)}
          className="bg-success hover:bg-success/90"
        >
          <Navigation className="h-4 w-4 mr-2" />
          Continuar Ruta
        </Button>
      </div>
    );
  }

  // Determine counts based on route type
  const stopsData = isPlannedRoute ? paradas : envios;
  const pickupsCount = isPlannedRoute 
    ? paradas.filter(p => p.tipo === 'retiro').length
    : envios.filter(e => e.envio?.requiere_retiro).length;
  const deliveriesCount = isPlannedRoute
    ? paradas.filter(p => p.tipo === 'entrega').length
    : envios.filter(e => !e.envio?.requiere_retiro).length;
  const sucursalesCount = isPlannedRoute ? paradas.filter(p => p.tipo === 'sucursal').length : 0;
  const totalStops = isPlannedRoute ? (rutaPlanificada?.total_paradas || paradas.length) : (hojaRuta?.cantidad_envios || envios.length);
  const distanceKm = isPlannedRoute ? rutaPlanificada?.distancia_total_km : hojaRuta?.distancia_total_km;
  const durationHours = isPlannedRoute 
    ? (rutaPlanificada?.tiempo_estimado_minutos ? rutaPlanificada.tiempo_estimado_minutos / 60 : null)
    : hojaRuta?.tiempo_estimado_horas;
  const routeNumber = isPlannedRoute ? rutaPlanificada?.numero : hojaRuta?.numero;
  const routeDate = isPlannedRoute ? rutaPlanificada?.fecha : hojaRuta?.fecha_salida;
  const vehiculo = isPlannedRoute ? rutaPlanificada?.vehiculo : hojaRuta?.vehiculo;

  return (
    <div className="h-screen bg-background overflow-y-auto">
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
              <h1 className="text-lg font-bold">Iniciar Ruta</h1>
              <Badge variant="outline">Ruta no iniciada</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-32 space-y-4">
        <Card>
          <CardContent className="p-6">
            {/* Route Code */}
            <div className="text-center mb-6">
              <p className="text-sm text-muted-foreground">CÓDIGO</p>
              <p className="text-3xl font-bold text-primary">{routeNumber}</p>
              {isPlannedRoute && (
                <Badge className="mt-2 bg-chofer/10 text-chofer border-chofer">Ruta de Reparto</Badge>
              )}
            </div>

            {/* Date & Stops */}
            <div className="flex justify-center gap-8 mb-6">
              <div className="text-center">
                <Calendar className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-sm text-muted-foreground">Fecha</p>
                <p className="font-semibold">
                  {routeDate 
                    ? format(new Date(routeDate), 'dd/MM/yyyy', { locale: es })
                    : 'Hoy'}
                </p>
              </div>
              <div className="text-center">
                <MapPin className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-sm text-muted-foreground">{isPlannedRoute ? 'Paradas' : 'Visitas'}</p>
                <p className="font-semibold">{totalStops}</p>
              </div>
            </div>

            {/* Route Info */}
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground mb-3">Recorrido programado</p>
              
              <div className="flex justify-around mb-4">
                <div className="text-center">
                  <Clock className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">DURACIÓN</p>
                  <p className="font-semibold">{durationHours?.toFixed(1) || '2.0'} hs.</p>
                </div>
                <div className="text-center">
                  <Route className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">DISTANCIA</p>
                  <p className="font-semibold">{distanceKm?.toFixed(1) || '0'} km</p>
                </div>
              </div>

              <div className="flex justify-center gap-6">
                {pickupsCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-chofer" />
                    <div>
                      <p className="text-xs text-muted-foreground">RETIROS</p>
                      <p className="font-semibold">{pickupsCount}</p>
                    </div>
                  </div>
                )}
                {deliveriesCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">ENTREGAS</p>
                      <p className="font-semibold">{deliveriesCount}</p>
                    </div>
                  </div>
                )}
                {sucursalesCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">SUCURSALES</p>
                      <p className="font-semibold">{sucursalesCount}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-3">Estadísticas</p>
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <div className="text-2xl font-bold text-muted-foreground">0%</div>
                  <p className="text-xs text-muted-foreground">CUMPLIMIENTO</p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-3 h-3 rounded-full bg-success" />
                    0 Realizados
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-3 h-3 rounded-full bg-destructive" />
                    0 Fallidos
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Info */}
        {vehiculo && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Truck className="h-6 w-6 text-muted-foreground" />
              <div>
                <p className="font-medium">{vehiculo.patente}</p>
                <p className="text-sm text-muted-foreground">
                  {vehiculo.marca} {vehiculo.modelo}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Slide to Start */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t">
        <div
          className="relative h-14 bg-primary/20 rounded-full overflow-hidden cursor-pointer"
          onMouseDown={handleSlideStart}
          onMouseMove={handleSlideMove}
          onMouseUp={handleSlideEnd}
          onMouseLeave={handleSlideEnd}
          onTouchStart={handleSlideStart}
          onTouchMove={handleSlideMove}
          onTouchEnd={handleSlideEnd}
        >
          {/* Progress fill */}
          <div 
            className="absolute inset-y-0 left-0 bg-primary/30 transition-all"
            style={{ width: `${slideProgress}%` }}
          />
          
          {/* Slider button */}
          <div 
            className="absolute top-1 bottom-1 left-1 w-12 bg-primary rounded-full flex items-center justify-center shadow-lg transition-transform"
            style={{ transform: `translateX(${(slideProgress / 100) * (300 - 48)}px)` }}
          >
            <Truck className="h-5 w-5 text-primary-foreground" />
          </div>
          
          {/* Text */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm font-medium text-primary">
              Desliza para iniciar
            </span>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="h-8 w-8 text-primary" />
              </div>
              
              <h3 className="text-xl font-bold mb-2">¿Quieres iniciar la ruta?</h3>
              
              <p className="text-muted-foreground text-sm mb-6">
                Una vez que inicies la ruta notificaremos los horarios estimados de llegada a los clientes
              </p>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowConfirmation(false);
                    setSlideProgress(0);
                  }}
                  className="flex-1"
                >
                  No
                </Button>
                <Button
                  onClick={() => startRouteMutation.mutate()}
                  disabled={startRouteMutation.isPending}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  {startRouteMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Iniciando...
                    </>
                  ) : (
                    'Quiero iniciar'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
