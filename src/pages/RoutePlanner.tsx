import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Route,
  MapPin,
  Truck,
  Package,
  Home,
  Navigation,
  Zap,
  Clock,
  Loader2,
  Printer,
  Calendar,
  User,
  CheckCircle,
  PlayCircle,
  Building2,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import MapView from "@/components/maps/MapView";

interface RouteStop {
  envio_id: string;
  tipo: "retiro" | "entrega";
  direccion: string;
  lat: number;
  lng: number;
  cliente_nombre: string;
  telefono: string;
  tracking: string;
}

interface RouteOption {
  name: string;
  stops: RouteStop[];
  totalDistance: number;
  estimatedTime: number;
  reasoning: string;
}

export default function RoutePlanner() {
  const { profile, roles } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("crear");
  const [selectedEnvios, setSelectedEnvios] = useState<string[]>([]);
  const [selectedChofer, setSelectedChofer] = useState<string>("");
  const [selectedVehiculo, setSelectedVehiculo] = useState<string>("");
  const [routeDate, setRouteDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [routeStartTime, setRouteStartTime] = useState("09:00");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<RouteOption | null>(null);
  const [filterType, setFilterType] = useState<"all" | "retiro" | "entrega">("all");

  // Fetch sucursal de origen del usuario
  const { data: sucursalOrigen } = useQuery({
    queryKey: ["sucursal-origen", profile?.sucursal_id],
    queryFn: async () => {
      if (!profile?.sucursal_id) return null;
      
      const { data, error } = await supabase
        .from("sucursales")
        .select("id, nombre, direccion, ciudad, lat, lng")
        .eq("id", profile.sucursal_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.sucursal_id,
  });

  // Fetch envíos pendientes
  const { data: enviosPendientes = [], isLoading: loadingEnvios } = useQuery({
    queryKey: ["envios-planificador", profile?.sucursal_id],
    queryFn: async () => {
      const query = supabase
        .from("envios")
        .select(`
          *,
          remitente:clientes!envios_remitente_id_fkey(nombre, apellido, direccion, ciudad, telefono),
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, direccion, ciudad, telefono)
        `)
        .in("estado", ["pendiente", "recogido", "en_bodega", "en_reparto"])
        .is("chofer_id", null)
        .order("created_at", { ascending: false });

      // Filter by sucursal if not admin
      if (!roles.includes("admin") && !roles.includes("supervisor") && profile?.sucursal_id) {
        query.or(`sucursal_origen_id.eq.${profile.sucursal_id},sucursal_destino_id.eq.${profile.sucursal_id}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Map to include type (retiro/entrega)
      return data.map(envio => ({
        ...envio,
        tipo: envio.requiere_retiro && envio.estado === "pendiente" ? "retiro" : "entrega",
        coords: envio.requiere_retiro && envio.estado === "pendiente"
          ? { lat: envio.remitente_lat, lng: envio.remitente_lng }
          : { lat: envio.destinatario_lat, lng: envio.destinatario_lng },
      }));
    },
  });

  // Fetch choferes
  const { data: choferes = [] } = useQuery({
    queryKey: ["choferes-planificador"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "chofer");
      
      if (rolesError) throw rolesError;
      
      const choferIds = roles?.map(r => r.user_id) || [];
      if (choferIds.length === 0) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", choferIds)
        .eq("activo", true);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch vehículos
  const { data: vehiculos = [] } = useQuery({
    queryKey: ["vehiculos-planificador"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehiculos")
        .select("*")
        .in("estado", ["disponible", "en_ruta"]);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch rutas activas
  const { data: rutasActivas = [] } = useQuery({
    queryKey: ["rutas-activas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rutas_planificadas")
        .select(`
          *,
          sucursal:sucursales(nombre)
        `)
        .in("estado", ["confirmada", "en_progreso"])
        .order("fecha", { ascending: true });
      
      if (error) throw error;

      // Fetch driver profiles
      const driverIds = data?.map(r => r.chofer_id).filter(Boolean) || [];
      let profiles: any[] = [];
      if (driverIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, nombre, apellido")
          .in("user_id", driverIds);
        profiles = profs || [];
      }

      return data.map(ruta => ({
        ...ruta,
        chofer_profile: profiles.find(p => p.user_id === ruta.chofer_id),
      }));
    },
  });

  // Filter envios
  const filteredEnvios = useMemo(() => {
    return enviosPendientes.filter(e => {
      if (filterType === "all") return true;
      return e.tipo === filterType;
    });
  }, [enviosPendientes, filterType]);

  // Selected envios with coords
  const selectedEnviosData = useMemo(() => {
    return enviosPendientes.filter(e => selectedEnvios.includes(e.id));
  }, [enviosPendientes, selectedEnvios]);

  // Map markers
  const mapMarkers = useMemo(() => {
    const markers: Array<{ position: { lat: number; lng: number }; title: string }> = [];
    
    // Agregar sucursal de origen como primer marcador
    if (sucursalOrigen?.lat && sucursalOrigen?.lng) {
      markers.push({
        position: { lat: Number(sucursalOrigen.lat), lng: Number(sucursalOrigen.lng) },
        title: `🏢 Origen: ${sucursalOrigen.nombre}`,
      });
    }
    
    // Agregar envíos seleccionados
    selectedEnviosData
      .filter(e => e.coords?.lat && e.coords?.lng)
      .forEach((e, index) => {
        markers.push({
          position: { lat: Number(e.coords.lat), lng: Number(e.coords.lng) },
          title: `${index + 1}. ${e.tracking_number}`,
        });
      });
    
    return markers;
  }, [selectedEnviosData, sucursalOrigen]);

  const toggleEnvio = (id: string) => {
    setSelectedEnvios(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setRouteOptions([]);
    setSelectedOption(null);
  };

  const selectAll = () => {
    setSelectedEnvios(filteredEnvios.map(e => e.id));
    setRouteOptions([]);
    setSelectedOption(null);
  };

  const deselectAll = () => {
    setSelectedEnvios([]);
    setRouteOptions([]);
    setSelectedOption(null);
  };

  // Optimize route
  const optimizeRoute = async () => {
    if (selectedEnvios.length < 2) {
      toast.error("Selecciona al menos 2 envíos para optimizar");
      return;
    }

    // Advertencia si la sucursal no tiene coordenadas
    if (!sucursalOrigen?.lat || !sucursalOrigen?.lng) {
      toast.warning("La sucursal de origen no tiene coordenadas. Se usará ubicación por defecto.");
    }

    setIsOptimizing(true);

    try {
      const enviosConCoords = selectedEnviosData.filter(e => e.coords?.lat && e.coords?.lng);

      if (enviosConCoords.length < 2) {
        toast.error("Los envíos seleccionados no tienen coordenadas suficientes");
        return;
      }

      // Calculate distance between points (Haversine)
      const calcDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };

      // Nearest neighbor algorithm
      const nearestNeighbor = (stops: any[], startLat: number, startLng: number) => {
        const remaining = [...stops];
        const ordered: any[] = [];
        let currentLat = startLat;
        let currentLng = startLng;
        let totalDistance = 0;

        while (remaining.length > 0) {
          let nearestIdx = 0;
          let nearestDist = Infinity;

          for (let i = 0; i < remaining.length; i++) {
            const dist = calcDistance(currentLat, currentLng, 
              Number(remaining[i].coords.lat), Number(remaining[i].coords.lng));
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestIdx = i;
            }
          }

          const nearest = remaining.splice(nearestIdx, 1)[0];
          ordered.push(nearest);
          totalDistance += nearestDist;
          currentLat = Number(nearest.coords.lat);
          currentLng = Number(nearest.coords.lng);
        }

        return { ordered, totalDistance };
      };

      // Starting point from user's sucursal
      const startLat = sucursalOrigen?.lat ? Number(sucursalOrigen.lat) : -34.6037;
      const startLng = sucursalOrigen?.lng ? Number(sucursalOrigen.lng) : -58.3816;

      // Option 1: Pickups first, then deliveries
      const retiros = enviosConCoords.filter(e => e.tipo === "retiro");
      const entregas = enviosConCoords.filter(e => e.tipo === "entrega");
      
      const retirosOpt = nearestNeighbor(retiros, startLat, startLng);
      const lastRetiro = retirosOpt.ordered.length > 0 
        ? retirosOpt.ordered[retirosOpt.ordered.length - 1] 
        : { coords: { lat: startLat, lng: startLng } };
      const entregasOpt = nearestNeighbor(entregas, Number(lastRetiro.coords.lat), Number(lastRetiro.coords.lng));
      
      const option1Distance = retirosOpt.totalDistance + entregasOpt.totalDistance;
      const option1Stops = [...retirosOpt.ordered, ...entregasOpt.ordered].map(e => ({
        envio_id: e.id,
        tipo: e.tipo,
        direccion: e.tipo === "retiro" ? e.remitente?.direccion : e.destinatario?.direccion,
        lat: Number(e.coords.lat),
        lng: Number(e.coords.lng),
        cliente_nombre: e.tipo === "retiro" 
          ? `${e.remitente?.nombre || ''} ${e.remitente?.apellido || ''}`.trim()
          : `${e.destinatario?.nombre || ''} ${e.destinatario?.apellido || ''}`.trim(),
        telefono: e.tipo === "retiro" ? e.remitente?.telefono : e.destinatario?.telefono,
        tracking: e.tracking_number,
      }));

      // Option 2: All mixed by nearest neighbor
      const allMixed = nearestNeighbor(enviosConCoords, startLat, startLng);
      const option2Stops = allMixed.ordered.map(e => ({
        envio_id: e.id,
        tipo: e.tipo,
        direccion: e.tipo === "retiro" ? e.remitente?.direccion : e.destinatario?.direccion,
        lat: Number(e.coords.lat),
        lng: Number(e.coords.lng),
        cliente_nombre: e.tipo === "retiro" 
          ? `${e.remitente?.nombre || ''} ${e.remitente?.apellido || ''}`.trim()
          : `${e.destinatario?.nombre || ''} ${e.destinatario?.apellido || ''}`.trim(),
        telefono: e.tipo === "retiro" ? e.remitente?.telefono : e.destinatario?.telefono,
        tracking: e.tracking_number,
      }));

      const options: RouteOption[] = [
        {
          name: "🚀 Retiros primero",
          stops: option1Stops,
          totalDistance: Math.round(option1Distance * 1.3 * 10) / 10,
          estimatedTime: Math.round((option1Distance * 1.3 / 25 + option1Stops.length * 0.1) * 10) / 10,
          reasoning: "Retiros agrupados primero, luego entregas ordenadas por cercanía.",
        },
        {
          name: "⚡ Distancia mínima",
          stops: option2Stops,
          totalDistance: Math.round(allMixed.totalDistance * 1.3 * 10) / 10,
          estimatedTime: Math.round((allMixed.totalDistance * 1.3 / 25 + option2Stops.length * 0.1) * 10) / 10,
          reasoning: "Ruta optimizada por distancia total, alternando retiros y entregas.",
        },
      ];

      setRouteOptions(options);
      setSelectedOption(options[0]);
      toast.success("Rutas optimizadas generadas");

    } catch (error) {
      console.error("Error optimizing:", error);
      toast.error("Error al optimizar la ruta");
    } finally {
      setIsOptimizing(false);
    }
  };

  // Create route
  const createRouteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOption || !selectedChofer) {
        throw new Error("Selecciona una opción de ruta y un chofer");
      }

      // Generate route number
      const { data: numeroData, error: numeroError } = await supabase
        .rpc("generate_ruta_number");
      
      if (numeroError) throw numeroError;

      // Determine route type
      const hasRetiros = selectedOption.stops.some(s => s.tipo === "retiro");
      const hasEntregas = selectedOption.stops.some(s => s.tipo === "entrega");
      const tipo = hasRetiros && hasEntregas ? "mixta" : hasRetiros ? "retiro" : "entrega";

      // Create route
      const { data: ruta, error: rutaError } = await supabase
        .from("rutas_planificadas")
        .insert({
          numero: numeroData,
          fecha: routeDate,
          hora_inicio: routeStartTime,
          chofer_id: selectedChofer,
          vehiculo_id: selectedVehiculo || null,
          sucursal_id: profile?.sucursal_id,
          tipo,
          total_paradas: selectedOption.stops.length,
          distancia_total_km: selectedOption.totalDistance,
          tiempo_estimado_minutos: Math.round(selectedOption.estimatedTime * 60),
          estado: "confirmada",
          created_by: profile?.user_id,
        })
        .select()
        .single();

      if (rutaError) throw rutaError;

      // Create stops
      const paradasData = selectedOption.stops.map((stop, index) => ({
        ruta_id: ruta.id,
        envio_id: stop.envio_id,
        orden: index + 1,
        tipo: stop.tipo,
        direccion: stop.direccion,
        lat: stop.lat,
        lng: stop.lng,
      }));

      const { error: paradasError } = await supabase
        .from("ruta_paradas")
        .insert(paradasData);

      if (paradasError) throw paradasError;

      // Update shipments with driver
      const chofer = choferes.find(c => c.user_id === selectedChofer);
      const envioIds = selectedOption.stops.map(s => s.envio_id);

      const { error: updateError } = await supabase
        .from("envios")
        .update({
          chofer_id: selectedChofer,
          estado: "en_reparto",
        })
        .in("id", envioIds);

      if (updateError) throw updateError;

      return ruta;
    },
    onSuccess: (ruta) => {
      queryClient.invalidateQueries({ queryKey: ["envios-planificador"] });
      queryClient.invalidateQueries({ queryKey: ["rutas-activas"] });
      toast.success(`Ruta ${ruta.numero} creada exitosamente`);
      
      // Reset form
      setSelectedEnvios([]);
      setRouteOptions([]);
      setSelectedOption(null);
      setSelectedChofer("");
      setSelectedVehiculo("");
      
      setActiveTab("activas");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al crear la ruta");
    },
  });

  const retirosCount = filteredEnvios.filter(e => e.tipo === "retiro").length;
  const entregasCount = filteredEnvios.filter(e => e.tipo === "entrega").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Route className="h-6 w-6" />
          Planificador de Rutas
        </h1>
        <p className="text-muted-foreground">
          Optimiza y asigna rutas de entrega y retiro
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="crear">
            <Navigation className="mr-2 h-4 w-4" />
            Crear Ruta
          </TabsTrigger>
          <TabsTrigger value="activas">
            <PlayCircle className="mr-2 h-4 w-4" />
            Rutas Activas ({rutasActivas.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="crear" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Panel de selección */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Envíos Disponibles</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      Todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAll}>
                      Ninguno
                    </Button>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Badge 
                    variant={filterType === "all" ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setFilterType("all")}
                  >
                    Todos ({enviosPendientes.length})
                  </Badge>
                  <Badge 
                    variant={filterType === "retiro" ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setFilterType("retiro")}
                  >
                    <Home className="mr-1 h-3 w-3" />
                    Retiros ({retirosCount})
                  </Badge>
                  <Badge 
                    variant={filterType === "entrega" ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setFilterType("entrega")}
                  >
                    <Package className="mr-1 h-3 w-3" />
                    Entregas ({entregasCount})
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {loadingEnvios ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : filteredEnvios.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No hay envíos pendientes
                  </p>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Tracking</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Dirección</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEnvios.map(envio => (
                          <TableRow key={envio.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedEnvios.includes(envio.id)}
                                onCheckedChange={() => toggleEnvio(envio.id)}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {envio.tracking_number}
                            </TableCell>
                            <TableCell>
                              <Badge variant={envio.tipo === "retiro" ? "secondary" : "default"}>
                                {envio.tipo === "retiro" ? (
                                  <><Home className="mr-1 h-3 w-3" />Retiro</>
                                ) : (
                                  <><Package className="mr-1 h-3 w-3" />Entrega</>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {envio.tipo === "retiro" 
                                ? envio.remitente?.direccion 
                                : envio.destinatario?.direccion}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {selectedEnvios.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-primary font-medium mb-3">
                      {selectedEnvios.length} envío(s) seleccionado(s)
                    </p>
                    
                    <Button 
                      className="w-full" 
                      onClick={optimizeRoute}
                      disabled={isOptimizing || selectedEnvios.length < 2}
                    >
                      {isOptimizing ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Optimizando...</>
                      ) : (
                        <><Zap className="mr-2 h-4 w-4" />Optimizar Ruta</>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mapa */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Vista Previa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Indicador de sucursal de origen */}
                {sucursalOrigen && (
                  <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <Building2 className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">
                        Punto de partida: {sucursalOrigen.nombre}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sucursalOrigen.direccion}{sucursalOrigen.ciudad ? `, ${sucursalOrigen.ciudad}` : ''}
                      </p>
                    </div>
                  </div>
                )}

                {!sucursalOrigen && profile?.sucursal_id && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      No se pudo cargar la sucursal de origen
                    </p>
                  </div>
                )}

                {!profile?.sucursal_id && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      No tienes una sucursal asignada
                    </p>
                  </div>
                )}

                <div className="h-80 rounded-lg overflow-hidden">
                  <MapView
                    markers={mapMarkers}
                    center={
                      sucursalOrigen?.lat && sucursalOrigen?.lng 
                        ? { lat: Number(sucursalOrigen.lat), lng: Number(sucursalOrigen.lng) }
                        : mapMarkers.length > 0 
                          ? undefined 
                          : { lat: -34.6037, lng: -58.3816 }
                    }
                    zoom={12}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Opciones de ruta */}
          {routeOptions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Opciones de Ruta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {routeOptions.map((option, index) => (
                    <div
                      key={index}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedOption?.name === option.name
                          ? "border-primary bg-primary/5"
                          : "hover:border-muted-foreground"
                      }`}
                      onClick={() => setSelectedOption(option)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{option.name}</h4>
                        {selectedOption?.name === option.name && (
                          <CheckCircle className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground mb-2">
                        <span className="flex items-center gap-1">
                          <Navigation className="h-4 w-4" />
                          {option.totalDistance} km
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {option.estimatedTime} hs
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {option.stops.length} paradas
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{option.reasoning}</p>
                    </div>
                  ))}
                </div>

                {/* Asignación */}
                {selectedOption && (
                  <div className="border-t pt-4 space-y-4">
                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Chofer *</Label>
                        <Select value={selectedChofer} onValueChange={setSelectedChofer}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar chofer" />
                          </SelectTrigger>
                          <SelectContent>
                            {choferes.map(chofer => (
                              <SelectItem key={chofer.user_id} value={chofer.user_id}>
                                {chofer.nombre} {chofer.apellido}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Vehículo</Label>
                        <Select value={selectedVehiculo} onValueChange={setSelectedVehiculo}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sin asignar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Sin asignar</SelectItem>
                            {vehiculos.map(v => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.patente} - {v.marca}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Fecha</Label>
                        <Input
                          type="date"
                          value={routeDate}
                          onChange={(e) => setRouteDate(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Hora Inicio</Label>
                        <Input
                          type="time"
                          value={routeStartTime}
                          onChange={(e) => setRouteStartTime(e.target.value)}
                        />
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => createRouteMutation.mutate()}
                      disabled={!selectedChofer || createRouteMutation.isPending}
                    >
                      {createRouteMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando...</>
                      ) : (
                        <><Route className="mr-2 h-4 w-4" />Crear Ruta ({selectedOption.stops.length} paradas)</>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activas">
          <Card>
            <CardContent className="pt-6">
              {rutasActivas.length === 0 ? (
                <div className="text-center py-12">
                  <Route className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">No hay rutas activas</h3>
                  <p className="text-sm text-muted-foreground">
                    Crea una nueva ruta desde la pestaña "Crear Ruta"
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rutasActivas.map(ruta => (
                    <div key={ruta.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-mono font-medium">{ruta.numero}</h3>
                          <Badge variant={ruta.estado === "en_progreso" ? "default" : "secondary"}>
                            {ruta.estado === "en_progreso" ? "En Progreso" : "Confirmada"}
                          </Badge>
                          <Badge variant="outline">
                            {ruta.tipo === "mixta" ? "Mixta" : ruta.tipo === "retiro" ? "Retiros" : "Entregas"}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(ruta.fecha), "dd/MM/yyyy", { locale: es })}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {ruta.chofer_profile?.nombre} {ruta.chofer_profile?.apellido}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {ruta.paradas_completadas || 0}/{ruta.total_paradas} paradas
                        </span>
                        <span className="flex items-center gap-1">
                          <Navigation className="h-4 w-4" />
                          {ruta.distancia_total_km} km
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
