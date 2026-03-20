import { useState, useMemo, useEffect, useCallback } from "react";
import { fetchDirectionsPath } from "@/lib/fetchDirectionsPath";
import { usePersistedState } from '@/hooks/usePersistedState';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Package, Truck, RefreshCw, AlertCircle, Navigation, User, Clock, MapPin, Route, Eye, EyeOff, X, WifiOff, Bot, Sparkles, Loader2, Flame } from "lucide-react";
import HeatmapMapView from "@/components/maps/HeatmapMapView";
import { Button } from "@/components/ui/button";
import MapView from "@/components/maps/MapView";
import { RouteStatsPanel } from "@/components/maps/RouteStatsPanel";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDriverRoute } from "@/hooks/useDriverRoute";
import { toast } from "sonner";
import { useDriverRouteProgress } from "@/hooks/useDriverRouteProgress";
import { DriverCardEnhanced } from "@/components/livemap/DriverCardEnhanced";
import { DriverFilters, type DriverFilterStatus, type DriverFilterRoute, type DriverSortBy } from "@/components/livemap/DriverFilters";
import { DriverDetailPanel } from "@/components/livemap/DriverDetailPanel";

interface SucursalConEnvios {
  id: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  lat: number | null;
  lng: number | null;
  es_centro_logistico: boolean;
  envios_pendientes: number;
  envios_en_sucursal: number;
  envios_en_reparto: number;
}

interface DriverLocation {
  id: string;
  chofer_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  updated_at: string;
  nombre?: string;
  apellido?: string;
  ruta_activa?: {
    id: string;
    numero: string;
    estado: string;
  } | null;
  ultima_ruta?: {
    id: string;
    numero: string;
    estado: string;
    fecha: string;
    tiene_historial: boolean;
  } | null;
}

interface LocationHistoryPoint {
  lat: number;
  lng: number;
  recorded_at: string;
  speed?: number | null;
}

interface DriverAnalysis {
  eta_proxima_parada: string;
  eta_fin_ruta: string;
  riesgo_demora: "bajo" | "medio" | "alto";
  razon_riesgo: string;
  anomalias: Array<{
    tipo: string;
    mensaje: string;
    severidad: "info" | "warning" | "critical";
  }>;
  resumen: string;
}

interface OperationsSummary {
  resumen_general: string;
  chofer_mas_eficiente?: string;
  alertas: Array<{
    chofer: string;
    tipo: string;
    mensaje: string;
  }>;
  sugerencias: string[];
}

// Heatmap tab component
function HeatmapTab() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const { data: heatmapPoints = [], isLoading: heatmapLoading } = useQuery({
    queryKey: ["heatmap-deliveries", period],
    queryFn: async () => {
      const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
      const since = new Date();
      since.setDate(since.getDate() - daysMap[period]);

      const { data, error } = await supabase
        .from("envios")
        .select("entrega_lat, entrega_lng")
        .eq("estado", "entregado")
        .not("entrega_lat", "is", null)
        .not("entrega_lng", "is", null)
        .gte("fecha_entrega", since.toISOString());

      if (error) throw error;

      return (data || []).map(e => ({
        lat: Number(e.entrega_lat),
        lng: Number(e.entrega_lng),
        weight: 1,
      }));
    },
  });

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                Mapa de Calor - Entregas
              </CardTitle>
              <CardDescription>
                Densidad de entregas por zona
              </CardDescription>
            </div>
            <div className="flex gap-1">
              {(['7d', '30d', '90d'] as const).map(p => (
                <Button
                  key={p}
                  size="sm"
                  variant={period === p ? "default" : "outline"}
                  onClick={() => setPeriod(p)}
                >
                  {p === '7d' ? '7 días' : p === '30d' ? '30 días' : '90 días'}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {heatmapLoading ? (
            <div className="h-[500px] flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : heatmapPoints.length === 0 ? (
            <div className="h-[500px] rounded-lg border-2 border-dashed border-muted flex flex-col items-center justify-center gap-4 bg-muted/20">
              <Flame className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <h3 className="font-semibold text-lg mb-2">Sin datos de entregas</h3>
                <p className="text-muted-foreground">No hay entregas con coordenadas en el período seleccionado</p>
              </div>
            </div>
          ) : (
            <HeatmapMapView
              points={heatmapPoints}
              height="500px"
              radius={25}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Estadísticas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-3xl font-bold">{heatmapPoints.length}</p>
            <p className="text-sm text-muted-foreground">Entregas con coordenadas</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-2">Leyenda del mapa</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500" />
                <span className="text-sm">Baja densidad</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-yellow-500" />
                <span className="text-sm">Media densidad</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-orange-500" />
                <span className="text-sm">Alta densidad</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500" />
                <span className="text-sm">Muy alta densidad</span>
              </div>
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">Período</p>
            <p className="font-medium">
              {period === '7d' ? 'Últimos 7 días' : period === '30d' ? 'Últimos 30 días' : 'Últimos 90 días'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LiveMap() {
  const [activeTab, setActiveTab] = usePersistedState('ui-tab-live-map', "sucursales");
  const [driverLocations, setDriverLocations] = useState<DriverLocation[]>([]);
  
  // State for main map route visualization (street-level traceability)
  const [selectedDriverForMap, setSelectedDriverForMap] = useState<string | null>(null);
  const [selectedRouteForMap, setSelectedRouteForMap] = useState<string | null>(null);
  const [plannedRoutePolyline, setPlannedRoutePolyline] = useState<{ lat: number; lng: number }[]>([]);
  const [pendingStopsMarkers, setPendingStopsMarkers] = useState<Array<{
    position: { lat: number; lng: number };
    trackingNumber: string;
    address: string;
    order: number;
  }>>([]);
  
  // State for dialog route visualization (legacy)
  const [showRouteDialog, setShowRouteDialog] = useState(false);
  const [dialogDriverId, setDialogDriverId] = useState<string | null>(null);
  const [dialogRouteHistory, setDialogRouteHistory] = useState<LocationHistoryPoint[]>([]);
  const [loadingDialogHistory, setLoadingDialogHistory] = useState(false);
  const [dialogSnappedRoute, setDialogSnappedRoute] = useState<{ lat: number; lng: number }[]>([]);
  const [dialogDirectionsRoute, setDialogDirectionsRoute] = useState<{ lat: number; lng: number }[]>([]);
  const [isDialogSnapping, setIsDialogSnapping] = useState(false);

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, DriverAnalysis>>({});
  const [loadingAiAnalysis, setLoadingAiAnalysis] = useState<Record<string, boolean>>({});
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [operationsSummary, setOperationsSummary] = useState<OperationsSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Hook for main map route visualization
  const driverRoute = useDriverRoute();

  // Driver filters and detail panel state
  const [filterStatus, setFilterStatus] = usePersistedState<DriverFilterStatus>('driver-filter-status', 'all');
  const [filterRoute, setFilterRoute] = usePersistedState<DriverFilterRoute>('driver-filter-route', 'all');
  const [sortBy, setSortBy] = usePersistedState<DriverSortBy>('driver-sort-by', 'last_update');
  const [detailPanelDriverId, setDetailPanelDriverId] = useState<string | null>(null);
  const IDLE_ALERT_MINUTES = 15;

  // Query para sucursales
  const { data: sucursalesData = [], isLoading, refetch } = useQuery({
    queryKey: ["sucursales-live-map"],
    queryFn: async () => {
      const { data: sucursales, error: sucError } = await supabase
        .from("sucursales")
        .select("id, nombre, direccion, ciudad, lat, lng, es_centro_logistico")
        .eq("activa", true);

      if (sucError) throw sucError;

      const { data: envios, error: envError } = await supabase
        .from("envios")
        .select("sucursal_origen_id, sucursal_destino_id, estado")
        .in("estado", ["pendiente", "recogido", "en_sucursal", "en_reparto"]);

      if (envError) throw envError;

      return sucursales?.map(s => {
        const enviosPendientes = envios?.filter(e => 
          e.sucursal_origen_id === s.id && e.estado === "pendiente"
        ).length || 0;

        const enviosEnSucursal = envios?.filter(e =>
          (e.sucursal_destino_id === s.id || e.sucursal_origen_id === s.id) && 
          e.estado === "en_sucursal"
        ).length || 0;

        const enviosEnReparto = envios?.filter(e =>
          e.sucursal_origen_id === s.id && e.estado === "en_reparto"
        ).length || 0;

        return {
          ...s,
          envios_pendientes: enviosPendientes,
          envios_en_sucursal: enviosEnSucursal,
          envios_en_reparto: enviosEnReparto,
        } as SucursalConEnvios;
      }) || [];
    },
    refetchInterval: 30000,
  });

  // Query para ubicaciones de choferes (solo con rol 'chofer' válido)
  const { data: driversData = [], refetch: refetchDrivers } = useQuery({
    queryKey: ["driver-locations"],
    queryFn: async () => {
      // Obtener IDs de usuarios con rol 'chofer'
      const { data: choferRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "chofer");
      
      if (rolesError) throw rolesError;
      
      const validChoferIds = choferRoles?.map(r => r.user_id) || [];
      if (validChoferIds.length === 0) return [];

      // Filtrar solo choferes activos
      const { data: activeProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id")
        .in("user_id", validChoferIds)
        .eq("activo", true);

      if (profilesError) throw profilesError;

      const activeChoferIds = activeProfiles?.map(p => p.user_id) || [];
      if (activeChoferIds.length === 0) return [];

      // Obtener ubicaciones solo de choferes válidos
      const { data: locations, error: locError } = await supabase
        .from("driver_locations")
        .select("*")
        .in("chofer_id", validChoferIds)
        .order("updated_at", { ascending: false });
      
      if (locError) throw locError;
      
      if (!locations || locations.length === 0) return [];

      const driverIds = [...new Set(locations.map(l => l.chofer_id))];
      
      // Obtener perfiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nombre, apellido")
        .in("user_id", driverIds);

      // Obtener rutas activas (en_curso)
      const { data: rutasActivas } = await supabase
        .from("rutas_planificadas")
        .select("id, numero, estado, chofer_id")
        .in("chofer_id", driverIds)
        .eq("estado", "en_curso");

      // Obtener últimas rutas completadas para choferes sin ruta activa
      const choferesSinRutaActiva = driverIds.filter(
        id => !rutasActivas?.some(r => r.chofer_id === id)
      );
      
      let ultimasRutas: { id: string; numero: string; estado: string; chofer_id: string; created_at: string }[] = [];
      
      if (choferesSinRutaActiva.length > 0) {
        // Obtener rutas completadas con historial GPS
        const { data: rutasCompletadas } = await supabase
          .from("rutas_planificadas")
          .select("id, numero, estado, chofer_id, created_at")
          .in("chofer_id", choferesSinRutaActiva)
          .eq("estado", "completada")
          .order("created_at", { ascending: false });
        
        if (rutasCompletadas && rutasCompletadas.length > 0) {
          // Verificar cuáles tienen historial GPS
          const rutaIds = rutasCompletadas.map(r => r.id);
          const { data: historialCount } = await supabase
            .from("driver_location_history")
            .select("ruta_id")
            .in("ruta_id", rutaIds);
          
          const rutasConHistorial = new Set(historialCount?.map(h => h.ruta_id) || []);
          
          // Tomar la última ruta con historial por chofer
          const rutasPorChofer = new Map<string, typeof rutasCompletadas[0]>();
          for (const ruta of rutasCompletadas) {
            if (rutasConHistorial.has(ruta.id) && !rutasPorChofer.has(ruta.chofer_id)) {
              rutasPorChofer.set(ruta.chofer_id, ruta);
            }
          }
          ultimasRutas = Array.from(rutasPorChofer.values());
        }
      }

      return locations.map(loc => {
        const profile = profiles?.find(p => p.user_id === loc.chofer_id);
        const rutaActiva = rutasActivas?.find(r => r.chofer_id === loc.chofer_id);
        const ultimaRuta = ultimasRutas.find(r => r.chofer_id === loc.chofer_id);
        
        return {
          ...loc,
          nombre: profile?.nombre || "Chofer",
          apellido: profile?.apellido || "",
          ruta_activa: rutaActiva ? { id: rutaActiva.id, numero: rutaActiva.numero, estado: rutaActiva.estado } : null,
          ultima_ruta: !rutaActiva && ultimaRuta ? {
            id: ultimaRuta.id,
            numero: ultimaRuta.numero,
            estado: ultimaRuta.estado,
            fecha: ultimaRuta.created_at,
            tiene_historial: true
          } : null
        };
      });
    },
    refetchInterval: 30000,
  });

  // Realtime subscription for driver locations — merge directly into state
  useEffect(() => {
    const channel = supabase
      .channel('driver-locations-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'driver_locations'
        },
        (payload) => {
          const updated = payload.new as { chofer_id: string; lat: number; lng: number; updated_at: string; accuracy: number | null };
          setDriverLocations(prev =>
            prev.map(d =>
              d.chofer_id === updated.chofer_id
                ? { ...d, lat: updated.lat, lng: updated.lng, updated_at: updated.updated_at, accuracy: updated.accuracy }
                : d
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_locations'
        },
        () => {
          // New driver appeared — need full refetch to get profile/route data
          refetchDrivers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchDrivers]);

  // Sync initial/refetched data into local state
  useEffect(() => {
    setDriverLocations(driversData);
  }, [driversData]);

  // Enhanced driver data (progress, speed, contact)
  const activeRoutesMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of driverLocations) {
      if (d.ruta_activa) map[d.chofer_id] = d.ruta_activa.id;
    }
    return map;
  }, [driverLocations]);

  const driverIdsForProgress = useMemo(() => driverLocations.map(d => d.chofer_id), [driverLocations]);
  const { data: enhancedDriverData = {} } = useDriverRouteProgress(driverIdsForProgress, activeRoutesMap);

  // Filtered and sorted drivers
  const filteredDrivers = useMemo(() => {
    let list = [...driverLocations];

    // Filter by status
    if (filterStatus !== 'all') {
      list = list.filter(d => {
        const diff = (Date.now() - new Date(d.updated_at).getTime()) / (1000 * 60);
        if (filterStatus === 'active') return diff < 5;
        if (filterStatus === 'recent') return diff >= 5 && diff < 15;
        if (filterStatus === 'no_signal') return diff >= 15;
        return true;
      });
    }

    // Filter by route
    if (filterRoute === 'with_route') list = list.filter(d => !!d.ruta_activa);
    else if (filterRoute === 'without_route') list = list.filter(d => !d.ruta_activa);

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'name') return `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`);
      if (sortBy === 'progress') {
        const pa = enhancedDriverData[a.chofer_id]?.routeProgress?.percentage ?? -1;
        const pb = enhancedDriverData[b.chofer_id]?.routeProgress?.percentage ?? -1;
        return pb - pa;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return list;
  }, [driverLocations, filterStatus, filterRoute, sortBy, enhancedDriverData]);

  // Detail panel driver info
  const detailPanelDriver = useMemo(() => {
    return driverLocations.find(d => d.chofer_id === detailPanelDriverId);
  }, [driverLocations, detailPanelDriverId]);


  const sucursalesConCoords = useMemo(() => {
    return sucursalesData.filter(s => s.lat && s.lng);
  }, [sucursalesData]);

  const hasGeolocatedBranches = sucursalesConCoords.length > 0;
  const branchesWithoutCoords = sucursalesData.filter(s => !s.lat || !s.lng).length;

  // Map markers for branches
  const mapMarkers = useMemo(() => {
    return sucursalesConCoords.map(s => ({
      position: { lat: Number(s.lat), lng: Number(s.lng) },
      title: s.nombre,
    }));
  }, [sucursalesConCoords]);

  // Map markers for drivers - include data for DriverMarker component
  const driverMarkers = useMemo(() => {
    return driverLocations.map(driver => ({
      position: { lat: Number(driver.lat), lng: Number(driver.lng) },
      title: `${driver.nombre} ${driver.apellido}`,
      icon: 'driver' as const,
      data: {
        nombre: driver.nombre,
        apellido: driver.apellido,
        updated_at: driver.updated_at,
        ruta_activa: driver.ruta_activa,
      },
    }));
  }, [driverLocations]);

  // Get time status for driver
  const getDriverStatus = (updatedAt: string) => {
    const now = new Date();
    const updated = new Date(updatedAt);
    const diffMinutes = (now.getTime() - updated.getTime()) / (1000 * 60);
    
    if (diffMinutes < 5) return { color: "bg-green-500", label: "Activo" };
    if (diffMinutes < 15) return { color: "bg-yellow-500", label: "Reciente" };
    return { color: "bg-red-500", label: "Sin señal" };
  };

  // Load pending stops for a driver's active route
  const loadPendingStops = useCallback(async (rutaId: string) => {
    try {
      const { data: paradas } = await supabase
        .from("ruta_paradas")
        .select("envio_id, orden, estado")
        .eq("ruta_id", rutaId)
        .eq("estado", "pendiente")
        .order("orden");

      if (!paradas || paradas.length === 0) {
        setPendingStopsMarkers([]);
        return;
      }

      const envioIds = paradas.map(p => p.envio_id).filter(Boolean);
      if (envioIds.length === 0) {
        setPendingStopsMarkers([]);
        return;
      }

      const { data: envios } = await supabase
        .from("envios")
        .select("id, tracking_number, direccion_entrega, destinatario_lat, destinatario_lng")
        .in("id", envioIds);

      const stops = (paradas || [])
        .map(p => {
          const envio = envios?.find(e => e.id === p.envio_id);
          if (!envio?.destinatario_lat || !envio?.destinatario_lng) return null;
          return {
            position: { lat: Number(envio.destinatario_lat), lng: Number(envio.destinatario_lng) },
            trackingNumber: envio.tracking_number,
            address: envio.direccion_entrega || '',
            order: p.orden || 0,
          };
        })
        .filter(Boolean) as typeof pendingStopsMarkers;

      setPendingStopsMarkers(stops);
    } catch (err) {
      console.error('Error loading pending stops:', err);
      setPendingStopsMarkers([]);
    }
  }, []);

  // Compute planned route polyline via Directions API when pending stops change
  useEffect(() => {
    if (!selectedDriverForMap || pendingStopsMarkers.length === 0 || !window.google?.maps) {
      setPlannedRoutePolyline([]);
      return;
    }

    const driver = driverLocations.find(d => d.chofer_id === selectedDriverForMap);
    if (!driver) {
      setPlannedRoutePolyline([]);
      return;
    }

    const sortedStops = [...pendingStopsMarkers].sort((a, b) => a.order - b.order);
    const driverPos = { lat: Number(driver.lat), lng: Number(driver.lng) };

    const fetchPlannedRoute = async () => {
      try {
        const directionsService = new google.maps.DirectionsService();
        const allPoints = [driverPos, ...sortedStops.map(s => s.position)];
        const MAX_WAYPOINTS = 23;
        const fullPath: { lat: number; lng: number }[] = [];

        for (let i = 0; i < allPoints.length - 1; i += MAX_WAYPOINTS + 1) {
          const chunkStart = allPoints[i];
          const chunkEnd = allPoints[Math.min(i + MAX_WAYPOINTS + 1, allPoints.length - 1)];
          const waypoints = allPoints
            .slice(i + 1, Math.min(i + MAX_WAYPOINTS + 1, allPoints.length - 1))
            .map(p => ({ location: new google.maps.LatLng(p.lat, p.lng), stopover: true }));

          const result = await new Promise<google.maps.DirectionsResult | null>((resolve) => {
            directionsService.route(
              {
                origin: new google.maps.LatLng(chunkStart.lat, chunkStart.lng),
                destination: new google.maps.LatLng(chunkEnd.lat, chunkEnd.lng),
                waypoints,
                travelMode: google.maps.TravelMode.DRIVING,
                optimizeWaypoints: false,
              },
              (res, status) => {
                resolve(status === google.maps.DirectionsStatus.OK ? res : null);
              }
            );
          });

          if (result?.routes?.[0]?.overview_path) {
            const pathPoints = result.routes[0].overview_path.map(p => ({
              lat: p.lat(),
              lng: p.lng(),
            }));
            if (fullPath.length > 0) pathPoints.shift();
            fullPath.push(...pathPoints);
          }
        }

        setPlannedRoutePolyline(fullPath);
      } catch (err) {
        console.error('Error fetching planned route:', err);
        setPlannedRoutePolyline([]);
      }
    };

    fetchPlannedRoute();
  }, [selectedDriverForMap, pendingStopsMarkers, driverLocations]);

  // Toggle route visualization on main map
  const toggleRouteOnMap = useCallback((driverId: string, rutaId: string) => {
    if (selectedDriverForMap === driverId) {
      // Hide route
      setSelectedDriverForMap(null);
      setSelectedRouteForMap(null);
      setPendingStopsMarkers([]);
      setPlannedRoutePolyline([]);
      driverRoute.clearRoute();
    } else {
      // Show route
      setSelectedDriverForMap(driverId);
      setSelectedRouteForMap(rutaId);
      driverRoute.loadRoute(driverId, rutaId);
      loadPendingStops(rutaId);
    }
  }, [selectedDriverForMap, driverRoute, loadPendingStops]);

  // Load route history for dialog (legacy)
  const loadRouteHistoryForDialog = async (driverId: string, rutaId: string) => {
    setLoadingDialogHistory(true);
    setIsDialogSnapping(false);
    setDialogSnappedRoute([]);
    setDialogDirectionsRoute([]);
    setDialogDriverId(driverId);
    setShowRouteDialog(true);

    try {
      const { data: history, error } = await supabase
        .from('driver_location_history')
        .select('lat, lng, recorded_at, speed, accuracy')
        .eq('chofer_id', driverId)
        .eq('ruta_id', rutaId)
        .order('recorded_at', { ascending: true });

      if (error) throw error;

      // Filter out imprecise points (accuracy > 50m)
      const rawHistory = (history || [])
        .filter(h => {
          const acc = h.accuracy ? Number(h.accuracy) : 0;
          return acc === 0 || acc <= 50;
        })
        .map(h => ({
          lat: Number(h.lat),
          lng: Number(h.lng),
          recorded_at: h.recorded_at || '',
          speed: h.speed ? Number(h.speed) : null,
        }));

      setDialogRouteHistory(rawHistory);

      // Process with Snap to Roads if we have enough points
      if (rawHistory.length >= 2) {
        setIsDialogSnapping(true);
        try {
          const { data: snappedData, error: snapError } = await supabase.functions.invoke('snap-to-roads', {
            body: {
              points: rawHistory.map(p => ({ lat: p.lat, lng: p.lng })),
              interpolate: true
            }
          });

          if (snapError) {
            console.error('Snap to roads error:', snapError);
          } else if (snappedData?.snappedPoints && snappedData.snappedPoints.length > 0) {
            setDialogSnappedRoute(snappedData.snappedPoints.map((p: { lat: number; lng: number }) => ({
              lat: p.lat,
              lng: p.lng
            })));
            console.log(`Route snapped: ${rawHistory.length} → ${snappedData.snappedPoints.length} points`);
          }
        } catch (snapErr) {
          console.error('Failed to snap route:', snapErr);
        } finally {
          setIsDialogSnapping(false);
        }
      }
    } catch (err) {
      console.error('Error loading route history:', err);
      setDialogRouteHistory([]);
    } finally {
      setLoadingDialogHistory(false);
    }
  };

  // AI Analysis: per driver
  const analyzeDriver = async (driver: DriverLocation) => {
    if (!driver.ruta_activa) return;
    
    setLoadingAiAnalysis(prev => ({ ...prev, [driver.chofer_id]: true }));
    
    try {
      // Fetch pending stops for this route
      const { data: paradas } = await supabase
        .from("ruta_paradas")
        .select("envio_id, orden, estado")
        .eq("ruta_id", driver.ruta_activa.id)
        .order("orden");

      const pendingParadas = paradas?.filter(p => p.estado === "pendiente") || [];
      const completedParadas = paradas?.filter(p => p.estado === "completada") || [];

      // Fetch envio details for pending stops
      const pendingEnvioIds = pendingParadas.map(p => p.envio_id).filter(Boolean);
      let pendingStops: Array<{ lat: number; lng: number; address: string; trackingNumber: string }> = [];
      if (pendingEnvioIds.length > 0) {
        const { data: envios } = await supabase
          .from("envios")
          .select("id, tracking_number, direccion_entrega, destinatario_lat, destinatario_lng")
          .in("id", pendingEnvioIds);
        pendingStops = (envios || [])
          .filter(e => e.destinatario_lat && e.destinatario_lng)
          .map(e => ({
            lat: Number(e.destinatario_lat),
            lng: Number(e.destinatario_lng),
            address: e.direccion_entrega || "",
            trackingNumber: e.tracking_number,
          }));
      }

      // Fetch completed deliveries
      const completedEnvioIds = completedParadas.map(p => p.envio_id).filter(Boolean);
      let completedStops: Array<{ lat: number; lng: number; deliveredAt: string; trackingNumber: string }> = [];
      if (completedEnvioIds.length > 0) {
        const { data: envios } = await supabase
          .from("envios")
          .select("id, tracking_number, entrega_lat, entrega_lng, fecha_entrega")
          .in("id", completedEnvioIds)
          .eq("estado", "entregado");
        completedStops = (envios || [])
          .filter(e => e.entrega_lat && e.entrega_lng && e.fecha_entrega)
          .map(e => ({
            lat: Number(e.entrega_lat),
            lng: Number(e.entrega_lng),
            deliveredAt: e.fecha_entrega!,
            trackingNumber: e.tracking_number,
          }));
      }

      // Fetch recent location history
      const { data: history } = await supabase
        .from("driver_location_history")
        .select("lat, lng, recorded_at, speed")
        .eq("chofer_id", driver.chofer_id)
        .eq("ruta_id", driver.ruta_activa.id)
        .order("recorded_at", { ascending: true })
        .limit(100);

      const { data: fnData, error: fnError } = await supabase.functions.invoke("analyze-driver-route", {
        body: {
          mode: "driver",
          driverId: driver.chofer_id,
          routeId: driver.ruta_activa.id,
          currentPosition: { lat: driver.lat, lng: driver.lng },
          pendingStops,
          completedStops,
          locationHistory: (history || []).map(h => ({
            lat: Number(h.lat),
            lng: Number(h.lng),
            recorded_at: h.recorded_at,
            speed: h.speed ? Number(h.speed) : undefined,
          })),
        },
      });

      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);

      setAiAnalysis(prev => ({ ...prev, [driver.chofer_id]: fnData.analysis }));
      toast.success("Análisis IA completado");
    } catch (err) {
      console.error("AI analysis error:", err);
      toast.error("Error al analizar ruta con IA");
    } finally {
      setLoadingAiAnalysis(prev => ({ ...prev, [driver.chofer_id]: false }));
    }
  };

  // AI Summary: all drivers
  const generateSummary = async () => {
    setLoadingSummary(true);
    setShowSummaryDialog(true);
    setOperationsSummary(null);

    try {
      const driversWithRoutes = driverLocations.filter(d => d.ruta_activa);
      
      const driversData = driversWithRoutes.map(d => {
        const status = getDriverStatus(d.updated_at);
        return {
          name: `${d.nombre} ${d.apellido}`,
          activeRoute: d.ruta_activa!.numero,
          completedStops: 0, // Will be enriched by AI based on available data
          pendingStops: 0,
          status: status.label,
          lastUpdate: formatDistanceToNow(new Date(d.updated_at), { addSuffix: true, locale: es }),
        };
      });

      // Also include drivers without active route for context
      const inactiveDrivers = driverLocations.filter(d => !d.ruta_activa);
      inactiveDrivers.forEach(d => {
        const status = getDriverStatus(d.updated_at);
        driversData.push({
          name: `${d.nombre} ${d.apellido}`,
          activeRoute: "Sin ruta activa",
          completedStops: 0,
          pendingStops: 0,
          status: status.label,
          lastUpdate: formatDistanceToNow(new Date(d.updated_at), { addSuffix: true, locale: es }),
        });
      });

      const { data: fnData, error: fnError } = await supabase.functions.invoke("analyze-driver-route", {
        body: {
          mode: "summary",
          driversData,
        },
      });

      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);

      setOperationsSummary(fnData.analysis);
    } catch (err) {
      console.error("AI summary error:", err);
      toast.error("Error al generar resumen IA");
    } finally {
      setLoadingSummary(false);
    }
  };

  // Generate polyline path from dialog history - priority: directions > snapped > raw
  const dialogBasePoints = useMemo(() => {
    if (dialogSnappedRoute.length > 0) return dialogSnappedRoute;
    return dialogRouteHistory.map(point => ({ lat: point.lat, lng: point.lng }));
  }, [dialogRouteHistory, dialogSnappedRoute]);

  // Generate street-level path for dialog via Directions API
  useEffect(() => {
    if (dialogBasePoints.length < 2 || !window.google?.maps) {
      setDialogDirectionsRoute([]);
      return;
    }
    let cancelled = false;
    fetchDirectionsPath(dialogBasePoints).then(path => {
      if (!cancelled && path.length > 0) {
        setDialogDirectionsRoute(path);
        console.log(`Dialog directions route: ${dialogBasePoints.length} → ${path.length} points`);
      }
    }).catch(err => {
      console.warn('Dialog Directions API failed:', err);
    });
    return () => { cancelled = true; };
  }, [dialogBasePoints]);

  const dialogPolylinePath = useMemo(() => {
    if (dialogDirectionsRoute.length > 0) return dialogDirectionsRoute;
    if (dialogSnappedRoute.length > 0) return dialogSnappedRoute;
    return dialogRouteHistory.map(point => ({ lat: point.lat, lng: point.lng }));
  }, [dialogRouteHistory, dialogSnappedRoute, dialogDirectionsRoute]);

  // Get selected driver info for dialog
  const dialogSelectedDriver = useMemo(() => {
    return driverLocations.find(d => d.chofer_id === dialogDriverId);
  }, [driverLocations, dialogDriverId]);

  // Get selected driver info for main map
  const selectedDriverInfo = useMemo(() => {
    return driverLocations.find(d => d.chofer_id === selectedDriverForMap);
  }, [driverLocations, selectedDriverForMap]);

  // Combine driver markers with route markers for main map
  const mainMapMarkers = useMemo(() => {
    const markers: Array<{
      position: { lat: number; lng: number };
      title: string;
      icon: 'origin' | 'destination' | 'branch' | 'current' | 'warning' | 'driver';
      data?: any;
    }> = driverMarkers.map(m => ({
      position: m.position,
      title: m.title,
      icon: 'driver' as const,
      data: m.data,
    }));
    
    // Add start point marker when showing route
    if (driverRoute.polylinePath.length > 0 && selectedDriverForMap) {
      markers.push({
        position: driverRoute.polylinePath[0],
        title: "Inicio del recorrido",
        icon: "origin" as const,
      });
    }

    // Add pending delivery stop markers (orange destination markers)
    if (selectedDriverForMap && pendingStopsMarkers.length > 0) {
      pendingStopsMarkers.forEach((stop) => {
        markers.push({
          position: stop.position,
          title: `Parada #${stop.order} - ${stop.trackingNumber}`,
          icon: 'destination' as const,
        });
      });
    }
    
    return markers;
  }, [driverMarkers, driverRoute.polylinePath, selectedDriverForMap, pendingStopsMarkers]);

  // Stats
  const totalPendientes = sucursalesData.reduce((acc, s) => acc + s.envios_pendientes, 0);
  const totalEnSucursal = sucursalesData.reduce((acc, s) => acc + s.envios_en_sucursal, 0);
  const totalEnReparto = sucursalesData.reduce((acc, s) => acc + s.envios_en_reparto, 0);
  const centrosLogisticos = sucursalesData.filter(s => s.es_centro_logistico).length;

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case "bajo": return <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">🟢 Bajo</Badge>;
      case "medio": return <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">🟡 Medio</Badge>;
      case "alto": return <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30">🔴 Alto</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Mapa en Vivo
          </h1>
          <p className="text-muted-foreground">
            Sucursales, envíos y choferes en tiempo real
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => { refetch(); refetchDrivers(); }} 
          disabled={isLoading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Package className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalPendientes}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalEnSucursal}</p>
                <p className="text-xs text-muted-foreground">En Sucursal</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Truck className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalEnReparto}</p>
                <p className="text-xs text-muted-foreground">En Reparto</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{driverLocations.length}</p>
                <p className="text-xs text-muted-foreground">Choferes activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Sucursales and Choferes */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="sucursales" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Sucursales
          </TabsTrigger>
          <TabsTrigger value="choferes" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Choferes
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="flex items-center gap-2">
            <Flame className="h-4 w-4" />
            Heatmap
          </TabsTrigger>
        </TabsList>

        {/* Tab: Sucursales */}
        <TabsContent value="sucursales" className="mt-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Ubicación de Sucursales</CardTitle>
              </CardHeader>
              <CardContent>
                {!hasGeolocatedBranches ? (
                  <div className="h-[500px] rounded-lg border-2 border-dashed border-muted flex flex-col items-center justify-center gap-4 bg-muted/20">
                    <div className="p-4 rounded-full bg-warning/10">
                      <AlertCircle className="h-12 w-12 text-warning" />
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-lg mb-2">Sin sucursales geolocalizadas</h3>
                      <p className="text-muted-foreground mb-4 max-w-md">
                        {branchesWithoutCoords > 0 
                          ? `Hay ${branchesWithoutCoords} sucursales sin coordenadas. Geolocalizalas para verlas en el mapa.`
                          : 'No hay sucursales registradas aún.'}
                      </p>
                      <Button asChild>
                        <Link to="/admin/branches">
                          <Navigation className="h-4 w-4 mr-2" />
                          Ir a Sucursales
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="h-[500px] rounded-lg overflow-hidden">
                      <MapView
                        markers={mapMarkers}
                        center={{ lat: -34.6037, lng: -58.3816 }}
                        zoom={10}
                      />
                    </div>
                    <div className="flex gap-4 mt-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-purple-500"></div>
                        <span>Centro Logístico</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                        <span>Sucursal</span>
                      </div>
                      {branchesWithoutCoords > 0 && (
                        <div className="flex items-center gap-2 ml-auto text-warning">
                          <AlertCircle className="h-4 w-4" />
                          <span>{branchesWithoutCoords} sin geolocalizar</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Sucursales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {sucursalesData.map(sucursal => (
                    <div
                      key={sucursal.id}
                      className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">{sucursal.nombre}</h4>
                        {sucursal.es_centro_logistico && (
                          <Badge variant="secondary" className="text-xs">
                            Centro
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {sucursal.ciudad || sucursal.direccion}
                      </p>
                      {!sucursal.lat || !sucursal.lng ? (
                        <Badge variant="outline" className="text-xs text-warning border-warning/50">
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Sin geolocalizar
                        </Badge>
                      ) : (
                        <div className="flex gap-2 flex-wrap">
                          {sucursal.envios_pendientes > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Package className="mr-1 h-3 w-3" />
                              {sucursal.envios_pendientes} pend.
                            </Badge>
                          )}
                          {sucursal.envios_en_sucursal > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Building2 className="mr-1 h-3 w-3" />
                              {sucursal.envios_en_sucursal} en suc.
                            </Badge>
                          )}
                          {sucursal.envios_en_reparto > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Truck className="mr-1 h-3 w-3" />
                              {sucursal.envios_en_reparto} reparto
                            </Badge>
                          )}
                          {sucursal.envios_pendientes === 0 && 
                           sucursal.envios_en_sucursal === 0 && 
                           sucursal.envios_en_reparto === 0 && (
                            <span className="text-xs text-muted-foreground">Sin envíos activos</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Choferes en Ruta */}
        <TabsContent value="choferes" className="mt-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Tracking en Tiempo Real
                    </CardTitle>
                    <CardDescription>
                      Ubicación de choferes con rutas activas
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateSummary}
                      disabled={loadingSummary || driverLocations.length === 0}
                      className="flex items-center gap-2"
                    >
                      {loadingSummary ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Resumen IA
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => refetchDrivers()}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Actualizar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {driverLocations.length === 0 ? (
                  <div className="h-[500px] rounded-lg border-2 border-dashed border-muted flex flex-col items-center justify-center gap-4 bg-muted/20">
                    <div className="p-4 rounded-full bg-muted">
                      <Truck className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-lg mb-2">No hay choferes reportando ubicación</h3>
                      <p className="text-muted-foreground max-w-md">
                        Los choferes aparecerán aquí cuando inicien una ruta desde la app móvil
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="h-[500px] rounded-lg overflow-hidden relative">
                      <MapView 
                        markers={mainMapMarkers}
                        center={driverLocations.length > 0 
                          ? { lat: driverLocations[0].lat, lng: driverLocations[0].lng }
                          : { lat: -34.6037, lng: -58.3816 }
                        }
                        zoom={12}
                        polylinePath={selectedDriverForMap ? driverRoute.polylinePath : []}
                        secondaryPolylinePath={selectedDriverForMap ? plannedRoutePolyline : []}
                        useGradient={selectedDriverForMap !== null && driverRoute.snappedRoute.length > 0}
                        deliveryStops={selectedDriverForMap ? driverRoute.deliveryStops : []}
                      />
                      
                      {/* Route overlay indicator */}
                      {selectedDriverForMap && selectedDriverInfo && (
                        <div className="absolute top-3 left-3 right-3 z-10">
                          <div className="bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                              <div>
                                <p className="font-medium text-sm">
                                  Recorrido de {selectedDriverInfo.nombre} {selectedDriverInfo.apellido}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {driverRoute.isLoading ? 'Cargando...' : 
                                   driverRoute.isSnapping ? 'Procesando calles...' :
                                   driverRoute.snappedRoute.length > 0 ? 
                                     `${driverRoute.routeStats.pointsCount} puntos GPS → ${driverRoute.routeStats.snappedPointsCount} sobre calles` :
                                     `${driverRoute.routeStats.pointsCount} puntos GPS`}
                                </p>
                                {driverRoute.hasSignalGaps && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <WifiOff className="h-3 w-3 text-destructive" />
                                    <span className="text-xs text-destructive font-medium">
                                      Trayectoria incompleta - {driverRoute.signalGaps.length} tramo(s) sin señal
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedDriverForMap(null);
                                setSelectedRouteForMap(null);
                                setPlannedRoutePolyline([]);
                                driverRoute.clearRoute();
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* Route stats badges */}
                      {selectedDriverForMap && driverRoute.polylinePath.length > 0 && !driverRoute.isLoading && (
                        <div className="absolute bottom-3 left-3 right-3 z-10">
                          <div className="bg-background/95 backdrop-blur-sm rounded-lg p-2 shadow-lg border">
                            <RouteStatsPanel 
                              stats={driverRoute.routeStats}
                              isSnapping={driverRoute.isSnapping}
                              compact={true}
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Route type badge */}
                      {selectedDriverForMap && driverRoute.polylinePath.length > 0 && (
                        <div className="absolute top-16 right-3 z-10">
                          <Badge 
                            variant={driverRoute.snappedRoute.length > 0 ? "default" : "secondary"}
                            className="shadow-lg"
                          >
                            {driverRoute.snappedRoute.length > 0 ? (
                              <>
                                <Route className="h-3 w-3 mr-1" />
                                Ruta sobre calles
                              </>
                            ) : (
                              <>
                                <MapPin className="h-3 w-3 mr-1" />
                                Puntos GPS
                              </>
                            )}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-4 mt-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span>Activo (&lt;5 min)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span>Reciente (5-15 min)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span>Sin señal (+15 min)</span>
                      </div>
                      {selectedDriverForMap && (
                        <>
                          <div className="flex items-center gap-2 ml-auto">
                            <div className="w-3 h-1 rounded bg-primary" />
                            <span>Recorrido activo</span>
                          </div>
                          {plannedRoutePolyline.length > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-0 border-t-2 border-dashed border-blue-400" />
                              <span>Ruta planificada</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

             <div className="space-y-6">
              {/* Driver List */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Choferes ({filteredDrivers.length}/{driverLocations.length})
                    </CardTitle>
                  </div>
                  <DriverFilters
                    filterStatus={filterStatus}
                    filterRoute={filterRoute}
                    sortBy={sortBy}
                    onFilterStatusChange={setFilterStatus}
                    onFilterRouteChange={setFilterRoute}
                    onSortByChange={setSortBy}
                  />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {filteredDrivers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {driverLocations.length === 0 ? 'No hay choferes activos' : 'Sin resultados con estos filtros'}
                      </p>
                    ) : (
                      filteredDrivers.map((driver) => (
                        <DriverCardEnhanced
                          key={driver.id}
                          driver={driver}
                          enhancedData={enhancedDriverData[driver.chofer_id]}
                          isSelected={selectedDriverForMap === driver.chofer_id}
                          isAnalyzing={!!loadingAiAnalysis[driver.chofer_id]}
                          analysis={aiAnalysis[driver.chofer_id]}
                          onToggleRoute={toggleRouteOnMap}
                          onViewDetails={loadRouteHistoryForDialog}
                          onAnalyze={analyzeDriver}
                          onOpenPanel={(id) => setDetailPanelDriverId(id)}
                          onCloseAnalysis={(id) => setAiAnalysis(prev => { const next = { ...prev }; delete next[id]; return next; })}
                          getRiskBadge={getRiskBadge}
                          idleAlertMinutes={IDLE_ALERT_MINUTES}
                        />
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Resumen de Choferes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total rastreados</span>
                    <span className="font-medium">{driverLocations.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Con rutas activas</span>
                    <span className="font-medium">
                      {driverLocations.filter(d => d.ruta_activa).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Señal activa</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {driverLocations.filter(d => {
                        const diff = (Date.now() - new Date(d.updated_at).getTime()) / (1000 * 60);
                        return diff < 5;
                      }).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Sin señal reciente</span>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      {driverLocations.filter(d => {
                        const diff = (Date.now() - new Date(d.updated_at).getTime()) / (1000 * 60);
                        return diff >= 15;
                      }).length}
                    </span>
                  </div>
                  {Object.values(enhancedDriverData).some(d => d.idleMinutes >= IDLE_ALERT_MINUTES && (d.speed ?? 0) < 2 && activeRoutesMap[d.choferId]) && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">⚠ Detenidos</span>
                      <span className="font-medium text-orange-600 dark:text-orange-400">
                        {Object.values(enhancedDriverData).filter(d => d.idleMinutes >= IDLE_ALERT_MINUTES && (d.speed ?? 0) < 2 && activeRoutesMap[d.choferId]).length}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Heatmap */}
        <TabsContent value="heatmap" className="mt-6">
          <HeatmapTab />
        </TabsContent>
      </Tabs>

      {/* Driver Detail Panel */}
      <DriverDetailPanel
        open={!!detailPanelDriverId}
        onClose={() => setDetailPanelDriverId(null)}
        driverId={detailPanelDriverId}
        driverName={detailPanelDriver?.nombre || ''}
        driverLastName={detailPanelDriver?.apellido || ''}
        updatedAt={detailPanelDriver?.updated_at || new Date().toISOString()}
        activeRouteId={detailPanelDriver?.ruta_activa?.id || null}
        activeRouteNumber={detailPanelDriver?.ruta_activa?.numero || null}
        enhancedData={detailPanelDriverId ? enhancedDriverData[detailPanelDriverId] : undefined}
        onSelectRoute={toggleRouteOnMap}
      />

      {/* Route History Dialog */}
      <Dialog open={showRouteDialog} onOpenChange={setShowRouteDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Recorrido de {dialogSelectedDriver?.nombre} {dialogSelectedDriver?.apellido}
              {dialogSelectedDriver?.ruta_activa && (
                <Badge variant="outline" className="ml-2">
                  {dialogSelectedDriver.ruta_activa.numero}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {loadingDialogHistory ? (
              <div className="h-[400px] flex flex-col items-center justify-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Cargando historial de ubicación...</p>
              </div>
            ) : dialogRouteHistory.length === 0 ? (
              <div className="h-[400px] flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-lg bg-muted/20">
                <MapPin className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                  <p className="font-medium">Sin datos de recorrido</p>
                  <p className="text-sm text-muted-foreground">
                    El chofer aún no ha registrado puntos de ubicación en esta ruta
                  </p>
                </div>
              </div>
            ) : (
              <>
                {isDialogSnapping && (
                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Procesando ruta calle por calle...</span>
                  </div>
                )}
                
                <div className="h-[400px] rounded-lg overflow-hidden border relative">
                  <MapView
                    markers={[
                      {
                        position: dialogPolylinePath[0],
                        title: "Inicio del recorrido",
                        icon: "origin",
                      },
                      {
                        position: dialogPolylinePath[dialogPolylinePath.length - 1],
                        title: "Posición actual",
                        icon: "driver",
                      },
                    ]}
                    center={dialogPolylinePath[Math.floor(dialogPolylinePath.length / 2)]}
                    zoom={14}
                    polylinePath={dialogPolylinePath}
                  />
                  
                  <div className="absolute top-3 right-3 z-10">
                    <Badge 
                      variant={dialogSnappedRoute.length > 0 ? "default" : "secondary"}
                      className="shadow-lg"
                    >
                      {dialogSnappedRoute.length > 0 ? (
                        <>
                          <Route className="h-3 w-3 mr-1" />
                          Ruta sobre calles
                        </>
                      ) : (
                        <>
                          <MapPin className="h-3 w-3 mr-1" />
                          Puntos GPS
                        </>
                      )}
                    </Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Puntos GPS</p>
                    <p className="font-semibold text-lg">{dialogRouteHistory.length}</p>
                  </div>
                  {dialogSnappedRoute.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                      <p className="text-blue-600 dark:text-blue-400 text-xs">Puntos ajustados</p>
                      <p className="font-semibold text-lg text-blue-700 dark:text-blue-300">{dialogSnappedRoute.length}</p>
                    </div>
                  )}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Inicio</p>
                    <p className="font-medium">
                      {dialogRouteHistory[0] && format(new Date(dialogRouteHistory[0].recorded_at), "HH:mm", { locale: es })}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Último registro</p>
                    <p className="font-medium">
                      {dialogRouteHistory[dialogRouteHistory.length - 1] && format(new Date(dialogRouteHistory[dialogRouteHistory.length - 1].recorded_at), "HH:mm", { locale: es })}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Duración aprox.</p>
                    <p className="font-medium">
                      {dialogRouteHistory.length >= 2 && formatDistanceToNow(
                        new Date(dialogRouteHistory[0].recorded_at),
                        { locale: es }
                      )}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Operations Summary Dialog */}
      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Resumen Operativo con IA
            </DialogTitle>
          </DialogHeader>

          {loadingSummary ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analizando operación en curso...</p>
            </div>
          ) : operationsSummary ? (
            <div className="space-y-4 overflow-y-auto">
              {/* General Summary */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2">📊 Resumen General</h4>
                <p className="text-sm whitespace-pre-line">{operationsSummary.resumen_general}</p>
              </div>

              {/* Most efficient driver */}
              {operationsSummary.chofer_mas_eficiente && (
                <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
                  <h4 className="font-medium text-sm mb-1 text-green-700 dark:text-green-400">🏆 Chofer más eficiente</h4>
                  <p className="text-sm">{operationsSummary.chofer_mas_eficiente}</p>
                </div>
              )}

              {/* Alerts */}
              {operationsSummary.alertas.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">⚠️ Alertas</h4>
                  <div className="space-y-2">
                    {operationsSummary.alertas.map((alerta, idx) => (
                      <div key={idx} className="bg-yellow-500/10 rounded-lg px-3 py-2 border border-yellow-500/20">
                        <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">{alerta.chofer}</p>
                        <p className="text-sm">{alerta.mensaje}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {operationsSummary.sugerencias.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">💡 Sugerencias</h4>
                  <ul className="space-y-1">
                    {operationsSummary.sugerencias.map((s, idx) => (
                      <li key={idx} className="text-sm flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No se pudo generar el resumen</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
