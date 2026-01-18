import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { MapPin, Package, Clock, ChevronRight, Truck, Navigation, PlayCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';

export function MobileRoutesTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Invalidar caché al montar para obtener datos frescos
  useEffect(() => {
    console.log('[MobileRoutesTab] Mounting, invalidating cache for user:', user?.id);
    queryClient.invalidateQueries({ queryKey: ['mobile-all-hojas-ruta'] });
    queryClient.invalidateQueries({ queryKey: ['mobile-all-rutas-planificadas'] });
  }, [queryClient, user?.id]);

  // Fetch hojas de ruta
  const { data: hojasRuta, isLoading: loadingHojas } = useQuery({
    queryKey: ['mobile-all-hojas-ruta', user?.id],
    queryFn: async () => {
      console.log('[MobileRoutesTab] Fetching hojas_ruta for user:', user?.id);
      const { data, error } = await supabase
        .from('hojas_ruta')
        .select(`
          *,
          sucursal_origen:sucursales!hojas_ruta_sucursal_origen_id_fkey(nombre, ciudad),
          sucursal_destino:sucursales!hojas_ruta_sucursal_destino_id_fkey(nombre, ciudad)
        `)
        .eq('chofer_id', user?.id)
        .order('created_at', { ascending: false });
      
      console.log('[MobileRoutesTab] Fetched hojas_ruta:', data?.length, 'items', data);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always'
  });

  // Fetch rutas planificadas
  const { data: rutasPlanificadas, isLoading: loadingRutas } = useQuery({
    queryKey: ['mobile-all-rutas-planificadas', user?.id],
    queryFn: async () => {
      console.log('[MobileRoutesTab] Fetching rutas_planificadas for user:', user?.id);
      const { data, error } = await supabase
        .from('rutas_planificadas')
        .select('*')
        .eq('chofer_id', user?.id)
        .order('fecha', { ascending: false });
      
      console.log('[MobileRoutesTab] Fetched rutas_planificadas:', data?.length, 'items', data);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always'
  });

  const isLoading = loadingHojas || loadingRutas;

  const getStatusConfig = (estado: string) => {
    switch (estado) {
      case 'asignada':
        return { 
          badge: <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">Pendiente</Badge>,
          color: 'amber',
          icon: Clock
        };
      case 'confirmada':
        return { 
          badge: <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">Confirmada</Badge>,
          color: 'purple',
          icon: CheckCircle2
        };
      case 'en_transito':
      case 'en_progreso':
        return { 
          badge: <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">En Curso</Badge>,
          color: 'emerald',
          icon: Navigation
        };
      case 'completada':
      case 'finalizada':
        return { 
          badge: <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Completada</Badge>,
          color: 'blue',
          icon: CheckCircle2
        };
      default:
        return { 
          badge: <Badge variant="outline">{estado}</Badge>,
          color: 'slate',
          icon: Package
        };
    }
  };

  // Separate routes by status
  const activeHojas = hojasRuta?.filter(h => ['asignada', 'en_transito'].includes(h.estado || '')) || [];
  const completedHojas = hojasRuta?.filter(h => h.estado === 'completada') || [];
  const activeRutas = rutasPlanificadas?.filter(r => ['asignada', 'confirmada', 'en_progreso'].includes(r.estado || '')) || [];
  const completedRutas = rutasPlanificadas?.filter(r => r.estado === 'finalizada') || [];

  const RouteCard = ({ route, type }: { route: any; type: 'hoja' | 'planificada' }) => {
    const isHoja = type === 'hoja';
    const isActive = isHoja 
      ? ['asignada', 'en_transito'].includes(route.estado)
      : ['asignada', 'confirmada', 'en_progreso'].includes(route.estado);
    const isInProgress = route.estado === 'en_transito' || route.estado === 'en_progreso';
    const statusConfig = getStatusConfig(route.estado);

    // Determine correct navigation path
    const handleNavigate = () => {
      if (isInProgress) {
        // Route already in progress - go to active navigation
        navigate(`/active-route?id=${route.id}&type=${type}`);
      } else {
        // Route not started - go to start screen
        navigate(`/route-start?id=${route.id}&type=${type}`);
      }
    };

    return (
      <Card 
        className={`bg-slate-900/60 border-slate-800/50 cursor-pointer hover:border-primary/50 transition-all active:scale-[0.98] overflow-hidden ${
          isInProgress ? 'ring-2 ring-primary/30' : ''
        }`}
        onClick={handleNavigate}
      >
        {/* Progress indicator for active routes */}
        {isInProgress && (
          <div className="h-1 bg-gradient-to-r from-primary to-emerald-500" />
        )}
        
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="space-y-1.5">
              <p className="font-bold text-white text-lg">{route.numero}</p>
              {isHoja && route.sucursal_origen && (
                <div className="flex items-center gap-1.5 text-sm text-slate-300">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span>{route.sucursal_origen.ciudad}</span>
                  <ChevronRight className="h-3 w-3 text-slate-500" />
                  <span>{route.sucursal_destino?.ciudad}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {statusConfig.badge}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Package className="h-4 w-4" />
              <span>
                {isHoja 
                  ? `${route.cantidad_envios || 0} envíos`
                  : `${route.paradas_completadas || 0}/${route.total_paradas || 0} paradas`
                }
              </span>
            </div>
            {!isHoja && route.hora_inicio && (
              <div className="flex items-center gap-1.5 text-slate-400">
                <Clock className="h-4 w-4" />
                <span>{route.hora_inicio}</span>
              </div>
            )}
          </div>

          {isActive && (
            <button 
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all active:scale-[0.98] bg-gradient-to-r from-primary/20 to-emerald-500/20 hover:from-primary/30 hover:to-emerald-500/30"
              onClick={(e) => {
                e.stopPropagation();
                handleNavigate();
              }}
            >
              {isInProgress ? (
                <>
                  <Navigation className="h-5 w-5 text-primary" />
                  <span className="text-primary font-semibold">Continuar</span>
                </>
              ) : (
                <>
                  <PlayCircle className="h-5 w-5 text-primary" />
                  <span className="text-primary font-semibold">Iniciar Ruta</span>
                </>
              )}
              <ChevronRight className="h-5 w-5 text-primary" />
            </button>
          )}
        </CardContent>
      </Card>
    );
  };

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-3xl bg-slate-800/60 flex items-center justify-center mb-4">
        <Truck className="h-10 w-10 text-slate-500" />
      </div>
      <p className="text-slate-400 text-lg">{message}</p>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">Mis Rutas</h1>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="w-full h-12 bg-slate-900/60 border border-slate-800/50 rounded-xl p-1">
          <TabsTrigger 
            value="active" 
            className="flex-1 h-full rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white font-medium transition-all"
          >
            Activas ({activeHojas.length + activeRutas.length})
          </TabsTrigger>
          <TabsTrigger 
            value="completed" 
            className="flex-1 h-full rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white font-medium transition-all"
          >
            Completadas ({completedHojas.length + completedRutas.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 space-y-3">
          {activeHojas.length === 0 && activeRutas.length === 0 ? (
            <EmptyState message="No tienes rutas activas" />
          ) : (
            <>
              {activeHojas.map(hoja => (
                <RouteCard key={hoja.id} route={hoja} type="hoja" />
              ))}
              {activeRutas.map(ruta => (
                <RouteCard key={ruta.id} route={ruta} type="planificada" />
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4 space-y-3">
          {completedHojas.length === 0 && completedRutas.length === 0 ? (
            <EmptyState message="No tienes rutas completadas" />
          ) : (
            <>
              {completedHojas.map(hoja => (
                <RouteCard key={hoja.id} route={hoja} type="hoja" />
              ))}
              {completedRutas.map(ruta => (
                <RouteCard key={ruta.id} route={ruta} type="planificada" />
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
