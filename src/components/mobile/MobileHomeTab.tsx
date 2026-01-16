import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Package, TrendingUp, MapPin, Clock, ChevronRight, Truck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface MobileHomeTabProps {
  onNavigateToRoutes: () => void;
}

export function MobileHomeTab({ onNavigateToRoutes }: MobileHomeTabProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Fetch active routes (hojas_ruta)
  const { data: hojasRuta, isLoading: loadingHojas } = useQuery({
    queryKey: ['mobile-hojas-ruta', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hojas_ruta')
        .select(`
          *,
          sucursal_origen:sucursales!hojas_ruta_sucursal_origen_id_fkey(nombre, ciudad),
          sucursal_destino:sucursales!hojas_ruta_sucursal_destino_id_fkey(nombre, ciudad)
        `)
        .eq('chofer_id', user?.id)
        .in('estado', ['asignada', 'en_transito'])
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Fetch planned routes (rutas_planificadas)
  const { data: rutasPlanificadas, isLoading: loadingRutas } = useQuery({
    queryKey: ['mobile-rutas-planificadas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rutas_planificadas')
        .select('*')
        .eq('chofer_id', user?.id)
        .in('estado', ['asignada', 'confirmada', 'en_progreso'])
        .order('fecha', { ascending: true })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Fetch today's stats
  const { data: todayStats } = useQuery({
    queryKey: ['mobile-today-stats', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: deliveries, error } = await supabase
        .from('envios')
        .select('id, precio_total, estado')
        .eq('chofer_id', user?.id)
        .gte('fecha_entrega', today)
        .lt('fecha_entrega', today + 'T23:59:59');
      
      if (error) throw error;
      
      const completed = deliveries?.filter(d => d.estado === 'entregado').length || 0;
      const total = deliveries?.length || 0;
      const earnings = deliveries?.reduce((sum, d) => sum + (d.precio_total || 0), 0) || 0;
      
      return { completed, total, earnings };
    },
    enabled: !!user?.id
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '¡Buenos días';
    if (hour < 18) return '¡Buenas tardes';
    return '¡Buenas noches';
  };

  const firstName = profile?.nombre?.split(' ')[0] || 'Chofer';

  // Get the most relevant active route
  const activeRoute = hojasRuta?.find(h => h.estado === 'en_transito') || 
                      rutasPlanificadas?.find(r => r.estado === 'en_progreso');

  const isLoading = loadingHojas || loadingRutas;

  return (
    <div className="space-y-6 pb-4">
      {/* Greeting */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">
          {getGreeting()}, {firstName}! 👋
        </h1>
        <p className="text-slate-400">
          {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
        </p>
      </div>

      {/* Active Route Card */}
      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : activeRoute ? (
        <Card 
          className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => {
            if ('numero' in activeRoute && 'sucursal_origen_id' in activeRoute) {
              navigate(`/driver/route?id=${activeRoute.id}&type=hoja`);
            } else {
              navigate(`/driver/route?id=${activeRoute.id}&type=ruta`);
            }
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                <span className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse" />
                RUTA ACTIVA
              </Badge>
              <ChevronRight className="h-5 w-5 text-primary" />
            </div>
            
            <div className="space-y-2">
              <p className="font-semibold text-white text-lg">
                {'numero' in activeRoute ? activeRoute.numero : (activeRoute as any).numero}
              </p>
              <div className="flex items-center gap-2 text-slate-300 text-sm">
                <MapPin className="h-4 w-4 text-primary" />
                {'sucursal_origen' in activeRoute 
                  ? `${(activeRoute as any).sucursal_origen?.ciudad} → ${(activeRoute as any).sucursal_destino?.ciudad}`
                  : `${(activeRoute as any).total_paradas || 0} paradas`
                }
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Package className="h-4 w-4" />
                {'cantidad_envios' in activeRoute 
                  ? `${activeRoute.cantidad_envios || 0} envíos`
                  : `${(activeRoute as any).paradas_completadas || 0}/${(activeRoute as any).total_paradas || 0} completadas`
                }
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center py-2 px-4 bg-primary/20 rounded-xl">
              <Truck className="h-4 w-4 text-primary mr-2" />
              <span className="text-primary font-medium">Continuar Ruta</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center mx-auto mb-3">
              <Truck className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-slate-400">No hay rutas activas</p>
            <button 
              onClick={onNavigateToRoutes}
              className="mt-3 text-primary text-sm font-medium"
            >
              Ver rutas pendientes →
            </button>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Hoy</p>
                <p className="text-white font-bold text-lg">
                  ${(todayStats?.earnings || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Entregas</p>
                <p className="text-white font-bold text-lg">
                  {todayStats?.completed || 0}/{todayStats?.total || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Routes */}
      {(hojasRuta && hojasRuta.length > 0) || (rutasPlanificadas && rutasPlanificadas.length > 0) ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Próximas Rutas</h2>
            <button 
              onClick={onNavigateToRoutes}
              className="text-primary text-sm font-medium"
            >
              Ver todas
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {hojasRuta?.filter(h => h.estado === 'asignada').map((hoja) => (
              <Card 
                key={hoja.id} 
                className="bg-slate-800/50 border-slate-700 min-w-[140px] cursor-pointer hover:border-slate-600 transition-colors"
                onClick={() => navigate(`/driver/route?id=${hoja.id}&type=hoja`)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-3 w-3 text-slate-400" />
                    <span className="text-xs text-slate-400">Pendiente</span>
                  </div>
                  <p className="font-medium text-white text-sm truncate">{hoja.numero}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {hoja.cantidad_envios || 0} envíos
                  </p>
                </CardContent>
              </Card>
            ))}

            {rutasPlanificadas?.filter(r => ['asignada', 'confirmada'].includes(r.estado || '')).map((ruta) => (
              <Card 
                key={ruta.id} 
                className="bg-slate-800/50 border-slate-700 min-w-[140px] cursor-pointer hover:border-slate-600 transition-colors"
                onClick={() => navigate(`/driver/route?id=${ruta.id}&type=ruta`)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-3 w-3 text-slate-400" />
                    <span className="text-xs text-slate-400">
                      {ruta.hora_inicio || 'Pendiente'}
                    </span>
                  </div>
                  <p className="font-medium text-white text-sm truncate">{ruta.numero}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {ruta.total_paradas || 0} paradas
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
