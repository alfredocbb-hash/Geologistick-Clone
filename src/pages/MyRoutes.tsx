import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Package, 
  Truck, 
  MapPin, 
  CheckCircle, 
  Clock, 
  PlayCircle, 
  Route as RouteIcon,
  QrCode,
  Loader2,
  Calendar,
  Navigation,
  Home,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import QRScanner from '@/components/qr/QRScanner';
import { ReceiveRouteSheetDialog } from '@/components/scan/ReceiveRouteSheetDialog';
import { CollectRouteSheetDialog } from '@/components/scan/CollectRouteSheetDialog';
import { parseDateString } from '@/lib/dateUtils';

interface HojaRuta {
  id: string;
  numero: string;
  estado: string;
  cantidad_envios: number | null;
  distancia_total_km: number | null;
  tiempo_estimado_horas: number | null;
  fecha_salida: string | null;
  inicio_real: string | null;
  fin_real: string | null;
  created_at: string;
  sucursal_origen: { nombre: string; codigo: string | null } | null;
  sucursal_destino: { nombre: string; codigo: string | null } | null;
  vehiculo: { patente: string; marca: string | null; modelo: string | null } | null;
}

interface RutaPlanificada {
  id: string;
  numero: string;
  estado: string;
  fecha: string;
  hora_inicio: string | null;
  total_paradas: number | null;
  paradas_completadas: number | null;
  distancia_total_km: number | null;
  tiempo_estimado_minutos: number | null;
  notas: string | null;
  tipo: string | null;
  created_at: string;
  vehiculo: { patente: string; marca: string | null; modelo: string | null } | null;
  sucursal: { nombre: string; codigo: string | null } | null;
}

export default function MyRoutes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [receiveHojaId, setReceiveHojaId] = useState<string | null>(null);
  const [collectHojaId, setCollectHojaId] = useState<string | null>(null);

  // Fetch my assigned route sheets (Hojas de Ruta - Inter-branch transfers)
  const { data: hojasRuta = [], isLoading: loadingHojas } = useQuery({
    queryKey: ['my-hojas-ruta', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('hojas_ruta')
        .select(`
          id,
          numero,
          estado,
          cantidad_envios,
          distancia_total_km,
          tiempo_estimado_horas,
          fecha_salida,
          inicio_real,
          fin_real,
          created_at,
          sucursal_origen:sucursales!hojas_ruta_sucursal_origen_id_fkey(nombre, codigo),
          sucursal_destino:sucursales!hojas_ruta_sucursal_destino_id_fkey(nombre, codigo),
          vehiculo:vehiculos(patente, marca, modelo)
        `)
        .eq('chofer_id', user.id)
        .in('estado', ['pendiente', 'en_transito', 'completada'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as HojaRuta[];
    },
    enabled: !!user?.id,
  });

  // Fetch my assigned planned routes (Rutas Planificadas - Delivery routes with stops)
  const { data: rutasPlanificadas = [], isLoading: loadingRutas } = useQuery({
    queryKey: ['my-rutas-planificadas', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('rutas_planificadas')
        .select(`
          id,
          numero,
          estado,
          fecha,
          hora_inicio,
          total_paradas,
          paradas_completadas,
          distancia_total_km,
          tiempo_estimado_minutos,
          notas,
          tipo,
          created_at,
          vehiculo:vehiculos(patente, marca, modelo),
          sucursal:sucursales(nombre, codigo)
        `)
        .eq('chofer_id', user.id)
        .in('estado', ['confirmada', 'en_curso', 'completada'])
        .order('fecha', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as RutaPlanificada[];
    },
    enabled: !!user?.id,
  });

  // Handle QR scan to receive route sheets
  const handleQRScan = async (data: string) => {
    setShowQRScanner(false);
    
    // Try to find a hoja de ruta by number or id
    const { data: hoja, error } = await supabase
      .from('hojas_ruta')
      .select('id, numero, estado')
      .or(`numero.eq.${data},id.eq.${data}`)
      .single();

    if (error || !hoja) {
      toast.error('Hoja de ruta no encontrada');
      return;
    }

    // Play beep sound
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1f');
    audio.play().catch(() => {});

    if (hoja.estado === 'en_transito' || hoja.estado === 'completada') {
      // If it's my route and in transit, go to active navigation
      navigate(`/active-route?id=${hoja.id}&type=hoja`);
    } else {
      // Show receive dialog
      setReceiveHojaId(hoja.id);
    }
  };

  const getHojaStatusBadge = (estado: string) => {
    const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      pendiente: { 
        label: 'Pendiente', 
        className: 'bg-warning/20 text-warning border-warning/30',
        icon: <Clock className="h-3 w-3" />
      },
      en_transito: { 
        label: 'En Curso', 
        className: 'bg-primary/20 text-primary border-primary/30',
        icon: <Navigation className="h-3 w-3" />
      },
      completada: { 
        label: 'Completada', 
        className: 'bg-success/20 text-success border-success/30',
        icon: <CheckCircle className="h-3 w-3" />
      },
    };
    const c = config[estado] || { label: estado, className: '', icon: null };
    return (
      <Badge variant="outline" className={`${c.className} flex items-center gap-1 font-semibold`}>
        {c.icon}
        {c.label}
      </Badge>
    );
  };

  const getRutaStatusBadge = (estado: string) => {
    const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      confirmada: { 
        label: 'Por Iniciar', 
        className: 'bg-warning/20 text-warning border-warning/30',
        icon: <Clock className="h-3 w-3" />
      },
      en_curso: { 
        label: 'En Curso', 
        className: 'bg-primary/20 text-primary border-primary/30',
        icon: <Navigation className="h-3 w-3" />
      },
      completada: { 
        label: 'Completada', 
        className: 'bg-success/20 text-success border-success/30',
        icon: <CheckCircle className="h-3 w-3" />
      },
    };
    const c = config[estado] || { label: estado, className: '', icon: null };
    return (
      <Badge variant="outline" className={`${c.className} flex items-center gap-1 font-semibold`}>
        {c.icon}
        {c.label}
      </Badge>
    );
  };

  // Categorize hojas de ruta
  const pendingHojas = hojasRuta.filter(h => h.estado === 'pendiente');
  const activeHojas = hojasRuta.filter(h => h.estado === 'en_transito');
  const completedHojas = hojasRuta.filter(h => h.estado === 'completada');

  // Categorize rutas planificadas
  const pendingRutas = rutasPlanificadas.filter(r => r.estado === 'confirmada');
  const activeRutas = rutasPlanificadas.filter(r => r.estado === 'en_curso');
  const completedRutas = rutasPlanificadas.filter(r => r.estado === 'completada');

  const isLoading = loadingHojas || loadingRutas;

  const stats = {
    pending: pendingHojas.length + pendingRutas.length,
    active: activeHojas.length + activeRutas.length,
    completed: completedHojas.length + completedRutas.length,
    totalEnvios: hojasRuta.reduce((acc, h) => acc + (h.cantidad_envios || 0), 0),
    totalParadas: rutasPlanificadas.reduce((acc, r) => acc + (r.total_paradas || 0), 0),
  };

  // Card for Hoja de Ruta (Inter-branch transfers)
  const HojaCard = ({ hoja }: { hoja: HojaRuta }) => {
    const isActive = hoja.estado === 'en_transito';
    const isPending = hoja.estado === 'pendiente';
    const isCompleted = hoja.estado === 'completada';

    return (
      <Card className={`glass-card hover-lift ${isCompleted ? 'opacity-70' : isActive ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-background' : ''}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-geo-blue/10 text-geo-blue border-geo-blue/20">Transferencia</Badge>
                {getHojaStatusBadge(hoja.estado)}
              </div>
              <h3 className="font-mono font-bold text-xl text-glow">{hoja.numero}</h3>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(parseDateString(hoja.created_at), 'PPP', { locale: es })}
              </div>
            </div>
            <div className="bg-primary/10 p-3 rounded-2xl text-center min-w-[70px]">
              <div className="text-2xl font-black text-primary leading-none">{hoja.cantidad_envios || 0}</div>
              <div className="text-[10px] uppercase font-bold text-primary/70 tracking-tighter">envíos</div>
            </div>
          </div>

          {/* Route info */}
          <div className="bg-muted/30 rounded-xl p-3 space-y-3 mb-5 border border-border/50">
            <div className="flex items-center gap-3">
              <div className="relative flex flex-col items-center">
                <div className="h-2 w-2 rounded-full bg-geo-teal shadow-[0_0_8px_hsl(var(--geo-teal))]" />
                <div className="w-[1px] h-4 bg-border" />
                <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
              </div>
              <div className="flex-1 text-sm space-y-2">
                <div className="font-bold flex justify-between">
                  <span>{hoja.sucursal_origen?.nombre || 'Origen'}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">SALIDA</span>
                </div>
                <div className="font-bold flex justify-between">
                  <span>{hoja.sucursal_destino?.nombre || 'Destino'}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">DESTINO</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              {hoja.vehiculo && (
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Truck className="h-3.5 w-3.5 text-primary" />
                  <span className="bg-muted px-2 py-0.5 rounded-md">{hoja.vehiculo.patente}</span>
                </div>
              )}

              {hoja.distancia_total_km && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                   <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {hoja.distancia_total_km.toFixed(1)} km
                   </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-auto">
            {isPending && (
              <>
                <Button 
                  variant="outline"
                  className="flex-1 rounded-xl h-12 font-bold border-muted-foreground/20"
                  onClick={() => setCollectHojaId(hoja.id)}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Recolectar
                </Button>
                <Button 
                  className="flex-1 btn-premium text-white rounded-xl h-12 font-bold shadow-lg"
                  onClick={() => navigate(`/route-start?id=${hoja.id}&type=hoja`)}
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Iniciar
                </Button>
              </>
            )}
            {isActive && (
              <Button 
                className="flex-1 btn-premium text-white rounded-xl h-12 font-bold shadow-lg"
                onClick={() => navigate(`/active-route?id=${hoja.id}&type=hoja`)}
              >
                <Navigation className="h-4 w-4 mr-2" />
                Ir al Mapa
              </Button>
            )}
            {isCompleted && hoja.fin_real && (
              <div className="bg-success/10 py-2.5 rounded-xl text-sm text-success font-bold flex items-center gap-2 w-full justify-center border border-success/20">
                <CheckCircle className="h-4 w-4" />
                Completada el {format(new Date(hoja.fin_real), 'dd/MM HH:mm', { locale: es })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Card for Ruta Planificada (Delivery routes with stops)
  const RutaCard = ({ ruta }: { ruta: RutaPlanificada }) => {
    const isActive = ruta.estado === 'en_curso';
    const isPending = ruta.estado === 'confirmada';
    const isCompleted = ruta.estado === 'completada';
    const progress = ruta.total_paradas && ruta.paradas_completadas 
      ? Math.round((ruta.paradas_completadas / ruta.total_paradas) * 100) 
      : 0;

    return (
      <Card className={`glass-card hover-lift ${isCompleted ? 'opacity-70' : isActive ? 'ring-2 ring-geo-teal ring-offset-2 dark:ring-offset-background' : ''}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-chofer/10 text-chofer border-chofer/20">
                  <Home className="h-3 w-3 mr-1" />
                  Reparto
                </Badge>
                {getRutaStatusBadge(ruta.estado)}
              </div>
              <h3 className="font-mono font-bold text-xl text-glow">{ruta.numero}</h3>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(parseDateString(ruta.fecha), 'PPP', { locale: es })}
              </div>
            </div>
            <div className="bg-chofer/10 p-3 rounded-2xl text-center min-w-[70px]">
              <div className="text-2xl font-black text-chofer leading-none">
                {ruta.paradas_completadas || 0}/{ruta.total_paradas || 0}
              </div>
              <div className="text-[10px] uppercase font-bold text-chofer/70 tracking-tighter">paradas</div>
            </div>
          </div>

          {/* Progress bar for active routes */}
          {isActive && (
            <div className="mb-5 bg-muted/30 p-3 rounded-xl border border-border/50">
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-muted-foreground">Progreso de entrega</span>
                <span className="text-primary">{progress}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Route info */}
          <div className="space-y-3 mb-5 px-1">
            {ruta.sucursal && (
              <div className="flex items-center gap-3 text-sm">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MapPin className="h-4 w-4 text-primary icon-glow" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Base de Operaciones</span>
                  <span className="font-bold">{ruta.sucursal.nombre}</span>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-6 pt-1">
              {ruta.vehiculo && (
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-bold bg-muted px-2 py-0.5 rounded-md">{ruta.vehiculo.patente}</span>
                </div>
              )}
              {ruta.distancia_total_km && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-bold">{ruta.distancia_total_km.toFixed(1)} km</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {isPending && (
              <Button 
                className="flex-1 btn-premium text-white rounded-xl h-12 font-bold shadow-lg"
                onClick={() => navigate(`/route-start?id=${ruta.id}&type=planificada`)}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Comenzar Jornada
              </Button>
            )}
            {isActive && (
              <Button 
                className="flex-1 btn-premium text-white rounded-xl h-12 font-bold shadow-lg"
                onClick={() => navigate(`/active-route?id=${ruta.id}&type=planificada`)}
              >
                <Navigation className="h-4 w-4 mr-2" />
                Continuar Navegación
              </Button>
            )}
            {isCompleted && (
              <div className="bg-success/10 py-2.5 rounded-xl text-sm text-success font-bold flex items-center gap-2 w-full justify-center border border-success/20">
                <CheckCircle className="h-4 w-4" />
                Jornada Finalizada
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 pb-10">
      {/* Header Premium */}
      <div className="relative overflow-hidden rounded-3xl bg-geo-dark p-6 text-white shadow-2xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-32 w-32 rounded-full bg-geo-teal/20 blur-3xl" />

        <div className="relative flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter text-glow">MIS RUTAS</h1>
            <p className="text-primary-foreground/60 text-xs font-bold uppercase tracking-widest">Panel de Chofer</p>
          </div>
          <Button
            onClick={() => setShowQRScanner(true)}
            className="rounded-2xl bg-white/10 hover:bg-white/20 border-white/10 backdrop-blur-md h-12 w-12 p-0"
          >
            <QrCode className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Stats Premium - Horizontal scroll on mobile */}
      <div className="flex gap-3 overflow-x-auto pb-2 px-1 no-scrollbar">
        <Card className="glass-card flex-1 min-w-[120px] p-4 text-center border-l-4 border-l-warning">
          <Clock className="h-5 w-5 text-warning mx-auto mb-2 icon-glow" />
          <div className="text-2xl font-black">{stats.pending}</div>
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Pendientes</div>
        </Card>
        <Card className="glass-card flex-1 min-w-[120px] p-4 text-center border-l-4 border-l-primary">
          <Navigation className="h-5 w-5 text-primary mx-auto mb-2 icon-glow" />
          <div className="text-2xl font-black">{stats.active}</div>
          <div className="text-[10px] uppercase font-bold text-muted-foreground">En Curso</div>
        </Card>
        <Card className="glass-card flex-1 min-w-[120px] p-4 text-center border-l-4 border-l-success">
          <CheckCircle className="h-5 w-5 text-success mx-auto mb-2 icon-glow" />
          <div className="text-2xl font-black">{stats.completed}</div>
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Listas</div>
        </Card>
      </div>

      {/* Active Routes Section - Highlights active work */}
      {(activeRutas.length > 0 || activeHojas.length > 0) && (
        <div className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 px-1">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary))]" />
            Trabajo en Curso
          </h2>
          <div className="space-y-4">
            {activeRutas.map((ruta) => (
              <RutaCard key={ruta.id} ruta={ruta} />
            ))}
            {activeHojas.map((hoja) => (
              <HojaCard key={hoja.id} hoja={hoja} />
            ))}
          </div>
        </div>
      )}

      {/* Tabs for Pending and Completed */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/50 rounded-2xl h-14">
          <TabsTrigger value="pending" className="rounded-xl font-bold data-[state=active]:shadow-lg">
            Por Iniciar
            {stats.pending > 0 && (
              <Badge className="ml-2 bg-primary text-white text-[10px] h-5 px-1.5">{stats.pending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="rounded-xl font-bold data-[state=active]:shadow-lg">
            Finalizadas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Sincronizando datos...</p>
            </div>
          ) : (pendingRutas.length === 0 && pendingHojas.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 bg-muted/20 rounded-3xl border-2 border-dashed border-border">
              <div className="bg-success/10 p-5 rounded-full">
                <CheckCircle className="h-10 w-10 text-success" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black">¡Todo al día!</h3>
                <p className="text-muted-foreground text-sm max-w-[200px]">No tienes tareas pendientes asignadas por ahora.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRutas.map((ruta) => (
                <RutaCard key={ruta.id} ruta={ruta} />
              ))}
              {pendingHojas.map((hoja) => (
                <HojaCard key={hoja.id} hoja={hoja} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (completedRutas.length === 0 && completedHojas.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 bg-muted/20 rounded-3xl border-2 border-dashed border-border">
               <RouteIcon className="h-12 w-12 text-muted-foreground" />
               <p className="text-muted-foreground text-sm">Historial vacío.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {completedRutas.map((ruta) => (
                <RutaCard key={ruta.id} ruta={ruta} />
              ))}
              {completedHojas.map((hoja) => (
                <HojaCard key={hoja.id} hoja={hoja} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* QR Scanner */}
      {showQRScanner && (
        <QRScanner 
          onScan={handleQRScan} 
          onClose={() => setShowQRScanner(false)} 
        />
      )}

      {/* Receive Route Sheet Dialog */}
      <ReceiveRouteSheetDialog
        hojaRutaId={receiveHojaId}
        onClose={() => setReceiveHojaId(null)}
      />
      
      {/* Collect Route Sheet Dialog */}
      <CollectRouteSheetDialog
        hojaRutaId={collectHojaId}
        onClose={() => setCollectHojaId(null)}
      />
    </div>
  );
}
