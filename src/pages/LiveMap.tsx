import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Package, Truck, RefreshCw, AlertCircle, Navigation, User, Clock, MapPin, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import MapView from "@/components/maps/MapView";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SucursalConEnvios {
  id: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  lat: number | null;
  lng: number | null;
  es_centro_logistico: boolean;
  envios_pendientes: number;
  envios_en_bodega: number;
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
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [, setSelectedRouteId] = useState<string | null>(null);
  const [showRouteDialog, setShowRouteDialog] = useState(false);
  const [routeHistory, setRouteHistory] = useState<LocationHistoryPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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
        .in("estado", ["pendiente", "recogido", "en_bodega", "en_reparto"]);

      if (envError) throw envError;

      return sucursales?.map(s => {
        const enviosPendientes = envios?.filter(e => 
          e.sucursal_origen_id === s.id && e.estado === "pendiente"
        ).length || 0;

        const enviosEnBodega = envios?.filter(e =>
          (e.sucursal_destino_id === s.id || e.sucursal_origen_id === s.id) && 
          e.estado === "en_bodega"
        ).length || 0;

        const enviosEnReparto = envios?.filter(e =>
          e.sucursal_origen_id === s.id && e.estado === "en_reparto"
        ).length || 0;

        return {
          ...s,
          envios_pendientes: enviosPendientes,
          envios_en_bodega: enviosEnBodega,
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

  // Load route history for a driver
  const loadRouteHistory = async (driverId: string, rutaId: string) => {
    setLoadingHistory(true);
    setSelectedDriverId(driverId);
    setSelectedRouteId(rutaId);
    setShowRouteDialog(true);

    try {
      const { data: history, error } = await supabase
        .from('driver_location_history')
        .select('lat, lng, recorded_at, speed')
        .eq('chofer_id', driverId)
        .eq('ruta_id', rutaId)
        .order('recorded_at', { ascending: true });

      if (error) throw error;

      setRouteHistory(history?.map(h => ({
        lat: Number(h.lat),
        lng: Number(h.lng),
        recorded_at: h.recorded_at,
        speed: h.speed ? Number(h.speed) : null,
      })) || []);
    } catch (err) {
      console.error('Error loading route history:', err);
      setRouteHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Generate polyline path from history
  const routePolylinePath = useMemo(() => {
    return routeHistory.map(point => ({ lat: point.lat, lng: point.lng }));
  }, [routeHistory]);

  // Get selected driver info
  const selectedDriver = useMemo(() => {
    return driverLocations.find(d => d.chofer_id === selectedDriverId);
  }, [driverLocations, selectedDriverId]);

  // Stats
  const totalPendientes = sucursalesData.reduce((acc, s) => acc + s.envios_pendientes, 0);
  const totalEnBodega = sucursalesData.reduce((acc, s) => acc + s.envios_en_bodega, 0);
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
                <p className="text-2xl font-bold">{totalEnBodega}</p>
                <p className="text-xs text-muted-foreground">En Bodega</p>
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
                          {sucursal.envios_en_bodega > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Building2 className="mr-1 h-3 w-3" />
                              {sucursal.envios_en_bodega} bodega
                            </Badge>
                          )}
                          {sucursal.envios_en_reparto > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Truck className="mr-1 h-3 w-3" />
                              {sucursal.envios_en_reparto} reparto
                            </Badge>
                          )}
                          {sucursal.envios_pendientes === 0 && 
                           sucursal.envios_en_bodega === 0 && 
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
                    <div className="h-[500px] rounded-lg overflow-hidden">
                      <MapView 
                        markers={driverMarkers}
                        center={driverLocations.length > 0 
                          ? { lat: driverLocations[0].lat, lng: driverLocations[0].lng }
                          : { lat: -34.6037, lng: -58.3816 }
                        }
                        zoom={12}
                      />
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
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-xs px-2"
                                  onClick={() => loadRouteHistory(driver.chofer_id, driver.ruta_activa!.id)}
                                >
                                  <Route className="h-3 w-3 mr-1" />
                                  Ver recorrido
                                </Button>
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
              Recorrido de {selectedDriver?.nombre} {selectedDriver?.apellido}
              {selectedDriver?.ruta_activa && (
                <Badge variant="outline" className="ml-2">
                  {selectedDriver.ruta_activa.numero}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {loadingHistory ? (
              <div className="h-[400px] flex items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : routeHistory.length === 0 ? (
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
                <div className="h-[400px] rounded-lg overflow-hidden border">
                  <MapView
                    markers={[
                      // Start point
                      {
                        position: routePolylinePath[0],
                        title: "Inicio del recorrido",
                        icon: "origin",
                      },
                      // Current/Last point
                      {
                        position: routePolylinePath[routePolylinePath.length - 1],
                        title: "Posición actual",
                        icon: "driver",
                      },
                    ]}
                    center={routePolylinePath[Math.floor(routePolylinePath.length / 2)]}
                    zoom={14}
                    polylinePath={routePolylinePath}
                  />
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Puntos registrados</p>
                    <p className="font-semibold text-lg">{routeHistory.length}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Inicio</p>
                    <p className="font-medium">
                      {routeHistory[0] && format(new Date(routeHistory[0].recorded_at), "HH:mm", { locale: es })}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Último registro</p>
                    <p className="font-medium">
                      {routeHistory[routeHistory.length - 1] && format(new Date(routeHistory[routeHistory.length - 1].recorded_at), "HH:mm", { locale: es })}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Duración aprox.</p>
                    <p className="font-medium">
                      {routeHistory.length >= 2 && formatDistanceToNow(
                        new Date(routeHistory[0].recorded_at),
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
