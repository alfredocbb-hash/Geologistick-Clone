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
  ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import QRScanner from '@/components/qr/QRScanner';
import { ReceiveRouteSheetDialog } from '@/components/scan/ReceiveRouteSheetDialog';
import { CollectRouteSheetDialog } from '@/components/scan/CollectRouteSheetDialog';

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
        className: 'bg-warning/10 text-warning border-warning',
        icon: <Clock className="h-3 w-3" />
      },
      en_transito: { 
        label: 'En Curso', 
        className: 'bg-primary/10 text-primary border-primary',
        icon: <Navigation className="h-3 w-3" />
      },
      completada: { 
        label: 'Completada', 
        className: 'bg-success/10 text-success border-success',
        icon: <CheckCircle className="h-3 w-3" />
      },
    };
    const c = config[estado] || { label: estado, className: '', icon: null };
    return (
      <Badge variant="outline" className={`${c.className} flex items-center gap-1`}>
        {c.icon}
        {c.label}
      </Badge>
    );
  };

  const getRutaStatusBadge = (estado: string) => {
    const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      confirmada: { 
        label: 'Por Iniciar', 
        className: 'bg-warning/10 text-warning border-warning',
        icon: <Clock className="h-3 w-3" />
      },
      en_curso: { 
        label: 'En Curso', 
        className: 'bg-primary/10 text-primary border-primary',
        icon: <Navigation className="h-3 w-3" />
      },
      completada: { 
        label: 'Completada', 
        className: 'bg-success/10 text-success border-success',
        icon: <CheckCircle className="h-3 w-3" />
      },
    };
    const c = config[estado] || { label: estado, className: '', icon: null };
    return (
      <Badge variant="outline" className={`${c.className} flex items-center gap-1`}>
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
      <Card className={isCompleted ? 'opacity-70' : isActive ? 'border-primary border-2' : ''}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="text-xs">Transferencia</Badge>
                {getHojaStatusBadge(hoja.estado)}
              </div>
              <span className="font-mono font-bold text-lg">{hoja.numero}</span>
              <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(hoja.created_at), 'dd/MM/yy HH:mm', { locale: es })}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{hoja.cantidad_envios || 0}</div>
              <div className="text-xs text-muted-foreground">envíos</div>
            </div>
          </div>

          {/* Route info */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium">{hoja.sucursal_origen?.nombre || 'Origen'}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{hoja.sucursal_destino?.nombre || 'Destino'}</span>
            </div>
            
            {hoja.vehiculo && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Truck className="h-4 w-4" />
                {hoja.vehiculo.patente}
                {hoja.vehiculo.marca && ` - ${hoja.vehiculo.marca} ${hoja.vehiculo.modelo || ''}`}
              </div>
            )}

            {hoja.distancia_total_km && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{hoja.distancia_total_km.toFixed(1)} km</span>
                {hoja.tiempo_estimado_horas && (
                  <span>~{Math.round(hoja.tiempo_estimado_horas * 60)} min</span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {isPending && (
              <>
                <Button 
                  variant="outline"
                  className="flex-1"
                  onClick={() => setCollectHojaId(hoja.id)}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Recolectar
                </Button>
                <Button 
                  className="flex-1 bg-primary hover:bg-primary/90"
                  onClick={() => navigate(`/route-start?id=${hoja.id}&type=hoja`)}
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Iniciar
                </Button>
              </>
            )}
            {isActive && (
              <Button 
                className="flex-1 bg-success hover:bg-success/90"
                onClick={() => navigate(`/active-route?id=${hoja.id}&type=hoja`)}
              >
                <Navigation className="h-4 w-4 mr-2" />
                Continuar Ruta
              </Button>
            )}
            {isCompleted && hoja.fin_real && (
              <div className="text-sm text-success flex items-center gap-1 w-full justify-center">
                <CheckCircle className="h-4 w-4" />
                Completada {format(new Date(hoja.fin_real), 'dd/MM HH:mm', { locale: es })}
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
      <Card className={isCompleted ? 'opacity-70' : isActive ? 'border-primary border-2' : ''}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="text-xs bg-chofer/10 text-chofer">
                  <Home className="h-3 w-3 mr-1" />
                  Reparto
                </Badge>
                {getRutaStatusBadge(ruta.estado)}
              </div>
              <span className="font-mono font-bold text-lg">{ruta.numero}</span>
              <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(ruta.fecha), 'dd/MM/yy', { locale: es })}
                {ruta.hora_inicio && ` ${ruta.hora_inicio.slice(0, 5)}`}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">
                {ruta.paradas_completadas || 0}/{ruta.total_paradas || 0}
              </div>
              <div className="text-xs text-muted-foreground">paradas</div>
            </div>
          </div>

          {/* Progress bar for active routes */}
          {isActive && ruta.total_paradas && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progreso</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Route info */}
          <div className="space-y-2 mb-4">
            {ruta.sucursal && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">Base: {ruta.sucursal.nombre}</span>
              </div>
            )}
            
            {ruta.vehiculo && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Truck className="h-4 w-4" />
                {ruta.vehiculo.patente}
                {ruta.vehiculo.marca && ` - ${ruta.vehiculo.marca} ${ruta.vehiculo.modelo || ''}`}
              </div>
            )}

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {ruta.distancia_total_km && (
                <span>{ruta.distancia_total_km.toFixed(1)} km</span>
              )}
              {ruta.tiempo_estimado_minutos && (
                <span>~{ruta.tiempo_estimado_minutos} min</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {isPending && (
              <Button 
                className="flex-1 bg-chofer hover:bg-chofer/90"
                onClick={() => navigate(`/route-start?id=${ruta.id}&type=planificada`)}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Iniciar Ruta
              </Button>
            )}
            {isActive && (
              <Button 
                className="flex-1 bg-success hover:bg-success/90"
                onClick={() => navigate(`/active-route?id=${ruta.id}&type=planificada`)}
              >
                <Navigation className="h-4 w-4 mr-2" />
                Continuar Ruta
              </Button>
            )}
            {isCompleted && (
              <div className="text-sm text-success flex items-center gap-1 w-full justify-center">
                <CheckCircle className="h-4 w-4" />
                Completada
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mis Rutas</h1>
          <p className="text-muted-foreground">Rutas y hojas de ruta asignadas</p>
        </div>
        <Button onClick={() => setShowQRScanner(true)} variant="outline">
          <QrCode className="h-4 w-4 mr-2" />
          Escanear
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por Iniciar</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Curso</CardTitle>
            <Navigation className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.active}</div>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card className="border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paradas</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEnvios + stats.totalParadas}</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Routes Section - Both Types */}
      {(activeRutas.length > 0 || activeHojas.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Navigation className="h-5 w-5 text-primary" />
            Rutas Activas
          </h2>
          <div className="space-y-3">
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Por Iniciar
            {stats.pending > 0 && (
              <Badge variant="secondary" className="ml-1">{stats.pending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Completadas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (pendingRutas.length === 0 && pendingHojas.length === 0) ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-success mb-4" />
                <h3 className="text-lg font-semibold">Sin rutas por iniciar</h3>
                <p className="text-muted-foreground text-center mt-2">
                  No tienes rutas pendientes de iniciar
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingRutas.map((ruta) => (
                <RutaCard key={ruta.id} ruta={ruta} />
              ))}
              {pendingHojas.map((hoja) => (
                <HojaCard key={hoja.id} hoja={hoja} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (completedRutas.length === 0 && completedHojas.length === 0) ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <RouteIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Sin rutas completadas</h3>
                <p className="text-muted-foreground text-center mt-2">
                  Aún no has completado ninguna ruta
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
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
