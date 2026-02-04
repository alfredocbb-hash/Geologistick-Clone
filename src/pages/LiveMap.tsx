import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Package, Truck, RefreshCw, AlertCircle, Navigation, User, Clock, MapPin, Route, Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import MapView from "@/components/maps/MapView";
import { RouteStatsPanel } from "@/components/maps/RouteStatsPanel";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDriverRoute } from "@/hooks/useDriverRoute";

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
}

interface LocationHistoryPoint {
  lat: number;
  lng: number;
  recorded_at: string;
  speed?: number | null;
}

export default function LiveMap() {
  const [activeTab, setActiveTab] = useState("sucursales");
  const [driverLocations, setDriverLocations] = useState<DriverLocation[]>([]);
  
  // State for main map route visualization (street-level traceability)
  const [selectedDriverForMap, setSelectedDriverForMap] = useState<string | null>(null);
  const [selectedRouteForMap, setSelectedRouteForMap] = useState<string | null>(null);
  
  // State for dialog route visualization (legacy)
  const [showRouteDialog, setShowRouteDialog] = useState(false);
  const [dialogDriverId, setDialogDriverId] = useState<string | null>(null);
  const [dialogRouteHistory, setDialogRouteHistory] = useState<LocationHistoryPoint[]>([]);
  const [loadingDialogHistory, setLoadingDialogHistory] = useState(false);
  const [dialogSnappedRoute, setDialogSnappedRoute] = useState<{ lat: number; lng: number }[]>([]);
  const [isDialogSnapping, setIsDialogSnapping] = useState(false);

  // Hook for main map route visualization
  const driverRoute = useDriverRoute();

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

  // Query para ubicaciones de choferes
  const { data: driversData = [], refetch: refetchDrivers } = useQuery({
    queryKey: ["driver-locations"],
    queryFn: async () => {
      const { data: locations, error: locError } = await supabase
        .from("driver_locations")
        .select("*")
        .order("updated_at", { ascending: false });
      
      if (locError) throw locError;
      
      if (!locations || locations.length === 0) return [];

      const driverIds = [...new Set(locations.map(l => l.chofer_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nombre, apellido")
        .in("user_id", driverIds);

      const { data: rutas } = await supabase
        .from("rutas_planificadas")
        .select("id, numero, estado, chofer_id")
        .in("chofer_id", driverIds)
        .eq("estado", "en_curso");

      return locations.map(loc => {
        const profile = profiles?.find(p => p.user_id === loc.chofer_id);
        const ruta = rutas?.find(r => r.chofer_id === loc.chofer_id);
        return {
          ...loc,
          nombre: profile?.nombre || "Chofer",
          apellido: profile?.apellido || "",
          ruta_activa: ruta ? { id: ruta.id, numero: ruta.numero, estado: ruta.estado } : null
        };
      });
    },
    refetchInterval: 30000,
  });

  // Realtime subscription for driver locations
  useEffect(() => {
    const channel = supabase
      .channel('driver-locations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations'
        },
        () => {
          refetchDrivers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchDrivers]);

  useEffect(() => {
    setDriverLocations(driversData);
  }, [driversData]);

  // Filter sucursales with coordinates
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

  // Map markers for drivers
  const driverMarkers = useMemo(() => {
    return driverLocations.map(driver => ({
      position: { lat: Number(driver.lat), lng: Number(driver.lng) },
      title: `${driver.nombre} ${driver.apellido}`,
      icon: 'driver' as const,
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

  // Toggle route visualization on main map
  const toggleRouteOnMap = useCallback((driverId: string, rutaId: string) => {
    if (selectedDriverForMap === driverId) {
      // Hide route
      setSelectedDriverForMap(null);
      setSelectedRouteForMap(null);
      driverRoute.clearRoute();
    } else {
      // Show route
      setSelectedDriverForMap(driverId);
      setSelectedRouteForMap(rutaId);
      driverRoute.loadRoute(driverId, rutaId);
    }
  }, [selectedDriverForMap, driverRoute]);

  // Load route history for dialog (legacy)
  const loadRouteHistoryForDialog = async (driverId: string, rutaId: string) => {
    setLoadingDialogHistory(true);
    setIsDialogSnapping(false);
    setDialogSnappedRoute([]);
    setDialogDriverId(driverId);
    setShowRouteDialog(true);

    try {
      const { data: history, error } = await supabase
        .from('driver_location_history')
        .select('lat, lng, recorded_at, speed')
        .eq('chofer_id', driverId)
        .eq('ruta_id', rutaId)
        .order('recorded_at', { ascending: true });

      if (error) throw error;

      const rawHistory = history?.map(h => ({
        lat: Number(h.lat),
        lng: Number(h.lng),
        recorded_at: h.recorded_at || '',
        speed: h.speed ? Number(h.speed) : null,
      })) || [];

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

  // Generate polyline path from dialog history - use snapped if available
  const dialogPolylinePath = useMemo(() => {
    if (dialogSnappedRoute.length > 0) {
      return dialogSnappedRoute;
    }
    return dialogRouteHistory.map(point => ({ lat: point.lat, lng: point.lng }));
  }, [dialogRouteHistory, dialogSnappedRoute]);

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
    }> = driverMarkers.map(m => ({
      position: m.position,
      title: m.title,
      icon: 'driver' as const,
    }));
    
    // Add start point marker when showing route
    if (driverRoute.polylinePath.length > 0 && selectedDriverForMap) {
      markers.push({
        position: driverRoute.polylinePath[0],
        title: "Inicio del recorrido",
        icon: "origin" as const,
      });
    }
    
    return markers;
  }, [driverMarkers, driverRoute.polylinePath, selectedDriverForMap]);

  // Stats
  const totalPendientes = sucursalesData.reduce((acc, s) => acc + s.envios_pendientes, 0);
  const totalEnSucursal = sucursalesData.reduce((acc, s) => acc + s.envios_en_sucursal, 0);
  const totalEnReparto = sucursalesData.reduce((acc, s) => acc + s.envios_en_reparto, 0);
  const centrosLogisticos = sucursalesData.filter(s => s.es_centro_logistico).length;

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
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="sucursales" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Sucursales
          </TabsTrigger>
          <TabsTrigger value="choferes" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Choferes en Ruta
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
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedDriverForMap(null);
                                setSelectedRouteForMap(null);
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
                        <div className="flex items-center gap-2 ml-auto">
                          <div className="w-3 h-1 rounded bg-primary" />
                          <span>Recorrido activo</span>
                        </div>
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
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Choferes ({driverLocations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {driverLocations.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No hay choferes activos
                      </p>
                    ) : (
                      driverLocations.map((driver) => {
                        const status = getDriverStatus(driver.updated_at);
                        return (
                          <div
                            key={driver.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${status.color}`} />
                              <div>
                                <p className="text-sm font-medium">
                                  {driver.nombre} {driver.apellido}
                                </p>
                                {driver.ruta_activa && (
                                  <p className="text-xs text-muted-foreground">
                                    Ruta: {driver.ruta_activa.numero}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                              <Badge variant="outline" className="text-xs">
                                {status.label}
                              </Badge>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(driver.updated_at), { 
                                  addSuffix: true, 
                                  locale: es 
                                })}
                              </p>
                              {driver.ruta_activa && (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant={selectedDriverForMap === driver.chofer_id ? "default" : "ghost"}
                                    className="h-6 text-xs px-2"
                                    onClick={() => toggleRouteOnMap(driver.chofer_id, driver.ruta_activa!.id)}
                                  >
                                    {selectedDriverForMap === driver.chofer_id ? (
                                      <><EyeOff className="h-3 w-3 mr-1" />Ocultar</>
                                    ) : (
                                      <><Eye className="h-3 w-3 mr-1" />Ver en mapa</>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-xs px-2"
                                    onClick={() => loadRouteHistoryForDialog(driver.chofer_id, driver.ruta_activa!.id)}
                                  >
                                    <Route className="h-3 w-3 mr-1" />
                                    Detalles
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
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
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

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
                      // Start point
                      {
                        position: dialogPolylinePath[0],
                        title: "Inicio del recorrido",
                        icon: "origin",
                      },
                      // Current/Last point
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
                  
                  {/* Route type indicator */}
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
    </div>
  );
}
