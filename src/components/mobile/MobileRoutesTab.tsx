import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { MapPin, Package, Clock, ChevronRight, Truck, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';

export function MobileRoutesTab() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch hojas de ruta
  const { data: hojasRuta, isLoading: loadingHojas } = useQuery({
    queryKey: ['mobile-all-hojas-ruta', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hojas_ruta')
        .select(`
          *,
          sucursal_origen:sucursales!hojas_ruta_sucursal_origen_id_fkey(nombre, ciudad),
          sucursal_destino:sucursales!hojas_ruta_sucursal_destino_id_fkey(nombre, ciudad)
        `)
        .eq('chofer_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Fetch rutas planificadas
  const { data: rutasPlanificadas, isLoading: loadingRutas } = useQuery({
    queryKey: ['mobile-all-rutas-planificadas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rutas_planificadas')
        .select('*')
        .eq('chofer_id', user?.id)
        .order('fecha', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const isLoading = loadingHojas || loadingRutas;

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case 'asignada':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendiente</Badge>;
      case 'en_transito':
      case 'en_progreso':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">En Curso</Badge>;
      case 'completada':
      case 'finalizada':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Completada</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  // Separate routes by status
  const activeHojas = hojasRuta?.filter(h => ['asignada', 'en_transito'].includes(h.estado || '')) || [];
  const completedHojas = hojasRuta?.filter(h => h.estado === 'completada') || [];
  const activeRutas = rutasPlanificadas?.filter(r => ['asignada', 'en_progreso'].includes(r.estado || '')) || [];
  const completedRutas = rutasPlanificadas?.filter(r => r.estado === 'finalizada') || [];

  const RouteCard = ({ route, type }: { route: any; type: 'hoja' | 'ruta' }) => {
    const isHoja = type === 'hoja';
    const isActive = isHoja 
      ? ['asignada', 'en_transito'].includes(route.estado)
      : ['asignada', 'en_progreso'].includes(route.estado);

    return (
      <Card 
        className={`bg-slate-800/50 border-slate-700 cursor-pointer hover:border-slate-600 transition-all ${
          isActive ? 'border-l-4 border-l-primary' : ''
        }`}
        onClick={() => navigate(`/driver/route?id=${route.id}&type=${type}`)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="space-y-1">
              <p className="font-semibold text-white">{route.numero}</p>
              {isHoja && route.sucursal_origen && (
                <div className="flex items-center gap-1 text-sm text-slate-400">
                  <MapPin className="h-3 w-3" />
                  {route.sucursal_origen.ciudad} → {route.sucursal_destino?.ciudad}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(route.estado)}
              <ChevronRight className="h-5 w-5 text-slate-500" />
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-slate-400">
              <Package className="h-4 w-4" />
              {isHoja 
                ? `${route.cantidad_envios || 0} envíos`
                : `${route.paradas_completadas || 0}/${route.total_paradas || 0} paradas`
              }
            </div>
            {!isHoja && route.hora_inicio && (
              <div className="flex items-center gap-1 text-slate-400">
                <Clock className="h-4 w-4" />
                {route.hora_inicio}
              </div>
            )}
          </div>

          {isActive && (
            <div className="mt-3 flex items-center justify-center py-2 bg-primary/10 rounded-lg">
              <Truck className="h-4 w-4 text-primary mr-2" />
              <span className="text-primary text-sm font-medium">
                {route.estado === 'en_transito' || route.estado === 'en_progreso' 
                  ? 'Continuar' 
                  : 'Iniciar'
                }
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
        <Truck className="h-8 w-8 text-slate-500" />
      </div>
      <p className="text-slate-400">{message}</p>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Mis Rutas</h1>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="w-full bg-slate-800/50 border border-slate-700">
          <TabsTrigger value="active" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Activas ({activeHojas.length + activeRutas.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
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
                <RouteCard key={ruta.id} route={ruta} type="ruta" />
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
                <RouteCard key={ruta.id} route={ruta} type="ruta" />
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
