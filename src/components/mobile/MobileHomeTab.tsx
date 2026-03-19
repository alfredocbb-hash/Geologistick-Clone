import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Package, TrendingUp, MapPin, Clock, ChevronRight, Truck, Navigation, Zap, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { getTodayString } from '@/lib/dateUtils';

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
        .in('estado', ['asignada', 'confirmada', 'en_curso', 'pendiente'])
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
      const today = getTodayString();
      
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
                      rutasPlanificadas?.find(r => r.estado === 'en_curso');

  const isLoading = loadingHojas || loadingRutas;

  // Calculate progress percentage
  const progressPercent = todayStats?.total 
    ? Math.round((todayStats.completed / todayStats.total) * 100) 
    : 0;

  return (
    <div className="space-y-5 pb-4">
      {/* Greeting Section */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">
          {getGreeting()}, {firstName}! 👋
        </h1>
        <p className="text-slate-400 capitalize">
          {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
        </p>
      </div>

      {/* Active Route Card - Hero Style */}
      {isLoading ? (
        <Skeleton className="h-44 w-full rounded-3xl" />
      ) : activeRoute ? (
        <Card 
          className="relative overflow-hidden bg-gradient-to-br from-primary/30 via-primary/20 to-emerald-500/20 border-primary/30 cursor-pointer group"
          onClick={() => {
            const type = 'sucursal_origen_id' in activeRoute ? 'hoja' : 'planificada';
            // Active routes are already in progress, go to active-route
            navigate(`/active-route?id=${activeRoute.id}&type=${type}`);
          }}
        >
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl" />
          </div>
          
          <CardContent className="relative p-5">
            <div className="flex items-center justify-between mb-4">
              <Badge className="bg-emerald-500/30 text-emerald-300 border-emerald-500/40 px-3 py-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
                RUTA ACTIVA
              </Badge>
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <Navigation className="h-5 w-5 text-white" />
              </div>
            </div>
            
            <div className="space-y-3">
              <p className="font-bold text-white text-xl">
                {'numero' in activeRoute ? activeRoute.numero : (activeRoute as any).numero}
              </p>
              
              <div className="flex items-center gap-2 text-slate-200 text-sm">
                <MapPin className="h-4 w-4 text-primary" />
                {'sucursal_origen' in activeRoute 
                  ? `${(activeRoute as any).sucursal_origen?.ciudad} → ${(activeRoute as any).sucursal_destino?.ciudad}`
                  : `${(activeRoute as any).total_paradas || 0} paradas`
                }
              </div>
              
              <div className="flex items-center gap-3 text-slate-300 text-sm">
                <div className="flex items-center gap-1.5">
                  <Package className="h-4 w-4" />
                  {'cantidad_envios' in activeRoute 
                    ? `${activeRoute.cantidad_envios || 0} envíos`
                    : `${(activeRoute as any).paradas_completadas || 0}/${(activeRoute as any).total_paradas || 0}`
                  }
                </div>
              </div>
            </div>

            {/* Continue button */}
            <button className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 bg-white/20 hover:bg-white/30 rounded-2xl transition-all active:scale-[0.98]">
              <Truck className="h-5 w-5 text-white" />
              <span className="text-white font-semibold">Continuar Ruta</span>
              <ChevronRight className="h-5 w-5 text-white" />
            </button>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-900/60 border-slate-800/50 backdrop-blur-xl">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto mb-4">
              <Truck className="h-8 w-8 text-slate-500" />
            </div>
            <p className="text-slate-400 mb-3">No hay rutas activas</p>
            <button 
              onClick={onNavigateToRoutes}
              className="inline-flex items-center gap-1 text-primary text-sm font-semibold hover:underline"
            >
              Ver rutas pendientes
              <ChevronRight className="h-4 w-4" />
            </button>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats - Modern Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-slate-900/60 border-slate-800/50 backdrop-blur-xl overflow-hidden">
          <CardContent className="p-4 relative">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl" />
            <div className="relative flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-slate-400 text-xs font-medium">Hoy</p>
                <p className="text-white font-bold text-xl mt-0.5">
                  ${(todayStats?.earnings || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800/50 backdrop-blur-xl overflow-hidden">
          <CardContent className="p-4 relative">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl" />
            <div className="relative flex items-start gap-3">
              <div className="relative w-12 h-12">
                {/* Circular progress */}
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                  <circle 
                    cx="24" cy="24" r="20" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="4"
                    className="text-slate-700"
                  />
                  <circle 
                    cx="24" cy="24" r="20" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="4"
                    strokeDasharray={`${progressPercent * 1.256} 126`}
                    strokeLinecap="round"
                    className="text-blue-400 transition-all duration-500"
                  />
                </svg>
                <Package className="absolute inset-0 m-auto h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-slate-400 text-xs font-medium">Entregas</p>
                <p className="text-white font-bold text-xl mt-0.5">
                  {todayStats?.completed || 0}/{todayStats?.total || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <button 
          onClick={onNavigateToRoutes}
          className="flex flex-col items-center gap-2 p-4 bg-slate-900/60 border border-slate-800/50 rounded-2xl hover:bg-slate-800/60 transition-all active:scale-95"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <Route className="h-6 w-6 text-primary" />
          </div>
          <span className="text-xs text-slate-300 font-medium">Rutas</span>
        </button>
        
        <button className="flex flex-col items-center gap-2 p-4 bg-slate-900/60 border border-slate-800/50 rounded-2xl hover:bg-slate-800/60 transition-all active:scale-95">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Clock className="h-6 w-6 text-amber-400" />
          </div>
          <span className="text-xs text-slate-300 font-medium">Historial</span>
        </button>
        
        <button className="flex flex-col items-center gap-2 p-4 bg-slate-900/60 border border-slate-800/50 rounded-2xl hover:bg-slate-800/60 transition-all active:scale-95">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Zap className="h-6 w-6 text-purple-400" />
          </div>
          <span className="text-xs text-slate-300 font-medium">Reportes</span>
        </button>
      </div>

      {/* Pending Routes */}
      {(hojasRuta && hojasRuta.length > 0) || (rutasPlanificadas && rutasPlanificadas.length > 0) ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Próximas Rutas</h2>
            <button 
              onClick={onNavigateToRoutes}
              className="text-primary text-sm font-medium flex items-center gap-1 hover:underline"
            >
              Ver todas
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {hojasRuta?.filter(h => h.estado === 'asignada').map((hoja) => (
              <Card 
                key={hoja.id} 
                className="bg-slate-900/60 border-slate-800/50 min-w-[160px] cursor-pointer hover:border-primary/50 transition-all active:scale-95"
                onClick={() => navigate(`/route-start?id=${hoja.id}&type=hoja`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-xs text-amber-400 font-medium">Pendiente</span>
                  </div>
                  <p className="font-semibold text-white text-sm truncate">{hoja.numero}</p>
                  <p className="text-xs text-slate-400 mt-1.5">
                    {hoja.cantidad_envios || 0} envíos
                  </p>
                </CardContent>
              </Card>
            ))}

            {rutasPlanificadas?.filter(r => ['asignada', 'confirmada'].includes(r.estado || '')).map((ruta) => (
              <Card 
                key={ruta.id} 
                className="bg-slate-900/60 border-slate-800/50 min-w-[160px] cursor-pointer hover:border-primary/50 transition-all active:scale-95"
                onClick={() => navigate(`/route-start?id=${ruta.id}&type=planificada`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-3 w-3 text-slate-400" />
                    <span className="text-xs text-slate-400">
                      {ruta.hora_inicio || 'Pendiente'}
                    </span>
                  </div>
                  <p className="font-semibold text-white text-sm truncate">{ruta.numero}</p>
                  <p className="text-xs text-slate-400 mt-1.5">
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

// Import Route icon
import { Route } from 'lucide-react';
