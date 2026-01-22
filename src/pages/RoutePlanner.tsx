import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
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
  Calendar,
  User,
  CheckCircle,
  PlayCircle,
  Building2,
  AlertTriangle,
  GripVertical,
  CalendarClock,
  Edit,
  RefreshCw,
  Upload,
  Star,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import MapView, { MarkerInfo } from "@/components/maps/MapView";
import { ShipmentMapPopup } from "@/components/maps/ShipmentMapPopup";
import { BranchMapPopup } from "@/components/maps/BranchMapPopup";
import EditRouteDialog from "@/components/routes/EditRouteDialog";
import CancelRouteDialog from "@/components/routes/CancelRouteDialog";
import ImportShipmentsDialog from "@/components/import/ImportShipmentsDialog";
import RescheduledShipmentsList from "@/components/routes/RescheduledShipmentsList";
import SaveFrequentRouteDialog from "@/components/routes/SaveFrequentRouteDialog";
import FrequentRoutesTab from "@/components/routes/FrequentRoutesTab";

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
  const [selectedMapItem, setSelectedMapItem] = useState<{
    type: 'envio' | 'sucursal';
    data: any;
  } | null>(null);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [editingRoute, setEditingRoute] = useState<any | null>(null);
  const [selectedReprogramados, setSelectedReprogramados] = useState<string[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showSaveFrequentDialog, setShowSaveFrequentDialog] = useState(false);
  const [cancellingRoute, setCancellingRoute] = useState<any | null>(null);

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

  // Fetch all branches with shipment counts
  const { data: sucursalesConEnvios = [] } = useQuery({
    queryKey: ["sucursales-con-envios"],
    queryFn: async () => {
      const { data: sucursales, error: sucError } = await supabase
        .from("sucursales")
        .select("*")
        .eq("activa", true);

      if (sucError) throw sucError;

      const { data: enviosCounts, error: envError } = await supabase
        .from("envios")
        .select("sucursal_origen_id")
        .in("estado", ["pendiente", "recogido", "en_bodega"])
        .is("chofer_id", null);

      if (envError) throw envError;

      // Count shipments per branch
      return (sucursales || []).map(s => ({
        ...s,
        enviosCount: (enviosCounts || []).filter(e => e.sucursal_origen_id === s.id).length
      }));
    },
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
        .in("estado", ["confirmada", "en_curso"])
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

  // Haversine distance calculation
  const calcDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // Calculate total distance for a route
  const calculateTotalDistance = useCallback((stops: RouteStop[]) => {
    if (stops.length < 1) return 0;
    
    let total = 0;
    const startLat = sucursalOrigen?.lat ? Number(sucursalOrigen.lat) : -34.6037;
    const startLng = sucursalOrigen?.lng ? Number(sucursalOrigen.lng) : -58.3816;
    
    // Distance from origin to first stop
    total += calcDistance(startLat, startLng, stops[0].lat, stops[0].lng);
    
    // Distance between stops
    for (let i = 0; i < stops.length - 1; i++) {
      total += calcDistance(stops[i].lat, stops[i].lng, stops[i+1].lat, stops[i+1].lng);
    }
    
    return Math.round(total * 1.3 * 10) / 10; // Road correction factor
  }, [calcDistance, sucursalOrigen]);

  // Handle drag and drop reordering
  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination || !selectedOption) return;
    
    const reorderedStops = Array.from(selectedOption.stops);
    const [movedItem] = reorderedStops.splice(result.source.index, 1);
    reorderedStops.splice(result.destination.index, 0, movedItem);
    
    // Recalculate distance
    const newDistance = calculateTotalDistance(reorderedStops);
    const newTime = Math.round((newDistance / 25 + reorderedStops.length * 0.1) * 10) / 10;
    
    setSelectedOption({
      ...selectedOption,
      stops: reorderedStops,
      totalDistance: newDistance,
      estimatedTime: newTime,
      reasoning: "Orden personalizado por el usuario",
    });
  }, [selectedOption, calculateTotalDistance]);

  // Geocode a shipment
  const geocodeEnvio = useCallback(async (envio: any) => {
    setIsGeolocating(true);
    try {
      const direccion = envio.tipo === "retiro" 
        ? envio.direccion_retiro || envio.remitente?.direccion 
        : envio.direccion_entrega || envio.destinatario?.direccion;
      const ciudad = envio.tipo === "retiro"
        ? envio.ciudad_retiro || envio.remitente?.ciudad
        : envio.ciudad_entrega || envio.destinatario?.ciudad;

      if (!direccion) {
        toast.error("El envío no tiene dirección");
        return;
      }

      const response = await supabase.functions.invoke('geocode-address', {
        body: { address: direccion, city: ciudad }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.lat && response.data?.lng) {
        const latField = envio.tipo === "retiro" ? "remitente_lat" : "destinatario_lat";
        const lngField = envio.tipo === "retiro" ? "remitente_lng" : "destinatario_lng";
        
        const { error } = await supabase
          .from("envios")
          .update({
            [latField]: response.data.lat,
            [lngField]: response.data.lng,
          })
          .eq("id", envio.id);

        if (error) throw error;

        toast.success("Envío geolocalizado correctamente");
        queryClient.invalidateQueries({ queryKey: ["envios-planificador"] });
      } else {
        toast.error("No se encontraron coordenadas para esta dirección");
      }
    } catch (error: any) {
      console.error("Geocode error:", error);
      toast.error(error.message || "Error al geolocalizar la dirección");
    } finally {
      setIsGeolocating(false);
      setSelectedMapItem(null);
    }
  }, [queryClient]);

  // Geocode a branch
  const geocodeSucursal = useCallback(async (sucursal: any) => {
    setIsGeolocating(true);
    try {
      if (!sucursal.direccion) {
        toast.error("La sucursal no tiene dirección");
        return;
      }

      const response = await supabase.functions.invoke('geocode-address', {
        body: { address: sucursal.direccion, city: sucursal.ciudad }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.lat && response.data?.lng) {
        const { error } = await supabase
          .from("sucursales")
          .update({
            lat: response.data.lat,
            lng: response.data.lng,
          })
          .eq("id", sucursal.id);

        if (error) throw error;

        toast.success("Sucursal geolocalizada correctamente");
        queryClient.invalidateQueries({ queryKey: ["sucursales-con-envios"] });
        queryClient.invalidateQueries({ queryKey: ["sucursal-origen"] });
      } else {
        toast.error("No se encontraron coordenadas para esta dirección");
      }
    } catch (error: any) {
      console.error("Geocode error:", error);
      toast.error(error.message || "Error al geolocalizar la sucursal");
    } finally {
      setIsGeolocating(false);
      setSelectedMapItem(null);
    }
  }, [queryClient]);

  // Handle marker click
  const handleMarkerClick = useCallback((marker: MarkerInfo) => {
    if (marker.type === 'envio' || marker.type === 'sucursal') {
      setSelectedMapItem({
        type: marker.type,
        data: marker.data,
      });
    }
  }, []);

  // Map markers - show all sucursales, selected shipments, and origin
  const mapMarkers = useMemo(() => {
    const markers: MarkerInfo[] = [];
    
    // 1. Add all branches (except origin)
    sucursalesConEnvios.forEach(sucursal => {
      if (sucursal.id !== sucursalOrigen?.id && sucursal.lat && sucursal.lng) {
        markers.push({
          id: sucursal.id,
          position: { lat: Number(sucursal.lat), lng: Number(sucursal.lng) },
          title: `🏢 ${sucursal.nombre}${sucursal.enviosCount ? ` (${sucursal.enviosCount} envíos)` : ''}`,
          icon: 'branch',
          type: 'sucursal',
          data: sucursal,
        });
      }
    });
    
    // 2. Add origin branch
    if (sucursalOrigen?.lat && sucursalOrigen?.lng) {
      const origenData = sucursalesConEnvios.find(s => s.id === sucursalOrigen.id) || sucursalOrigen;
      markers.push({
        id: sucursalOrigen.id,
        position: { lat: Number(sucursalOrigen.lat), lng: Number(sucursalOrigen.lng) },
        title: `📍 Origen: ${sucursalOrigen.nombre}`,
        icon: 'origin',
        type: 'origin',
        data: origenData,
      });
    }
    
    // 3. If optimized route, show ordered stops
    if (selectedOption) {
      selectedOption.stops.forEach((stop, index) => {
        const envio = selectedEnviosData.find(e => e.id === stop.envio_id);
        markers.push({
          id: stop.envio_id,
          position: { lat: stop.lat, lng: stop.lng },
          title: `${index + 1}. ${stop.tracking} - ${stop.cliente_nombre}`,
          icon: stop.tipo === 'retiro' ? 'current' : 'destination',
          type: 'envio',
          data: envio,
        });
      });
    } else {
      // 4. Show all selected shipments (with and without coords)
      selectedEnviosData.forEach((envio, index) => {
        const hasCoords = envio.coords?.lat && envio.coords?.lng;
        
        if (hasCoords) {
          markers.push({
            id: envio.id,
            position: { lat: Number(envio.coords.lat), lng: Number(envio.coords.lng) },
            title: `${index + 1}. ${envio.tracking_number}`,
            icon: envio.tipo === 'retiro' ? 'current' : 'destination',
            type: 'envio',
            data: envio,
          });
        }
      });
    }
    
    return markers;
  }, [selectedEnviosData, selectedOption, sucursalOrigen, sucursalesConEnvios]);

  // Polyline path for drawing route on map
  const routePolyline = useMemo(() => {
    if (!selectedOption) return [];
    
    const path: { lat: number; lng: number }[] = [];
    
    // Add origin branch as first point
    if (sucursalOrigen?.lat && sucursalOrigen?.lng) {
      path.push({ lat: Number(sucursalOrigen.lat), lng: Number(sucursalOrigen.lng) });
    }
    
    // Add each stop in order
    selectedOption.stops.forEach(stop => {
      if (stop.lat && stop.lng) {
        path.push({ lat: stop.lat, lng: stop.lng });
      }
    });
    
    return path;
  }, [selectedOption, sucursalOrigen]);

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
        direccion: e.tipo === "retiro" 
          ? (e.direccion_retiro || e.remitente?.direccion)
          : (e.direccion_entrega || e.destinatario?.direccion),
        lat: Number(e.coords.lat),
        lng: Number(e.coords.lng),
              cliente_nombre: e.tipo === "retiro" 
                ? ((e as any).nombre_remitente || `${e.remitente?.nombre || ''} ${e.remitente?.apellido || ''}`.trim())
                : ((e as any).nombre_destinatario || `${e.destinatario?.nombre || ''} ${e.destinatario?.apellido || ''}`.trim()),
        telefono: e.tipo === "retiro" ? e.remitente?.telefono : e.destinatario?.telefono,
        tracking: e.tracking_number,
      }));

      // Option 2: All mixed by nearest neighbor
      const allMixed = nearestNeighbor(enviosConCoords, startLat, startLng);
      const option2Stops = allMixed.ordered.map(e => ({
        envio_id: e.id,
        tipo: e.tipo,
        direccion: e.tipo === "retiro" 
          ? (e.direccion_retiro || e.remitente?.direccion)
          : (e.direccion_entrega || e.destinatario?.direccion),
        lat: Number(e.coords.lat),
        lng: Number(e.coords.lng),
              cliente_nombre: e.tipo === "retiro" 
                ? ((e as any).nombre_remitente || `${e.remitente?.nombre || ''} ${e.remitente?.apellido || ''}`.trim())
                : ((e as any).nombre_destinatario || `${e.destinatario?.nombre || ''} ${e.destinatario?.apellido || ''}`.trim()),
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
          tenant_id: profile?.tenant_id,
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
          <TabsTrigger value="frecuentes">
            <Star className="mr-2 h-4 w-4" />
            Frecuentes
          </TabsTrigger>
          <TabsTrigger value="reprogramados">
            <CalendarClock className="mr-2 h-4 w-4" />
            Reprogramados
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
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowImportDialog(true)}
                    >
                      <Upload className="mr-1 h-3 w-3" />
                      Importar CSV
                    </Button>
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
                          <TableHead>Localidad</TableHead>
                          <TableHead>Dirección</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEnvios.map(envio => {
                          // Get localidad based on type
                          const localidad = envio.tipo === "retiro"
                            ? (envio.ciudad_retiro || envio.remitente?.ciudad || '-')
                            : (envio.ciudad_entrega || envio.destinatario?.ciudad || '-');
                          
                          return (
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
                              <TableCell className="text-xs font-medium">
                                {localidad}
                              </TableCell>
                              <TableCell className="text-xs max-w-[150px] truncate">
                                {envio.tipo === "retiro" 
                                  ? (envio.direccion_retiro || envio.remitente?.direccion)
                                  : (envio.direccion_entrega || envio.destinatario?.direccion)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
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
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Vista Previa</CardTitle>
                  {/* Show count of shipments without coords */}
                  {selectedEnviosData.filter(e => !e.coords?.lat || !e.coords?.lng).length > 0 && (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-400">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      {selectedEnviosData.filter(e => !e.coords?.lat || !e.coords?.lng).length} sin coords
                    </Badge>
                  )}
                </div>
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

                {/* Legend */}
                <div className="flex flex-wrap gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    <span>Origen</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                    <span>Sucursales</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                    <span>Retiros</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                    <span>Entregas</span>
                  </div>
                </div>

                <div className="h-80 rounded-lg overflow-hidden">
                  <MapView
                    markers={mapMarkers}
                    polylinePath={routePolyline}
                    center={
                      sucursalOrigen?.lat && sucursalOrigen?.lng 
                        ? { lat: Number(sucursalOrigen.lat), lng: Number(sucursalOrigen.lng) }
                        : mapMarkers.length > 0 
                          ? undefined 
                          : { lat: -34.6037, lng: -58.3816 }
                    }
                    zoom={12}
                    onMarkerClick={handleMarkerClick}
                  />
                </div>

                {/* Shipments without coordinates list */}
                {selectedEnviosData.filter(e => !e.coords?.lat || !e.coords?.lng).length > 0 && (
                  <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 space-y-2">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Envíos sin geolocalizar
                    </p>
                    <div className="space-y-1">
                      {selectedEnviosData
                        .filter(e => !e.coords?.lat || !e.coords?.lng)
                        .map(envio => (
                          <div 
                            key={envio.id} 
                            className="flex items-center justify-between text-sm p-2 bg-white dark:bg-gray-800 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                            onClick={() => setSelectedMapItem({ type: 'envio', data: envio })}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs">{envio.tracking_number}</span>
                              <Badge variant="outline" className="text-xs">
                                {envio.tipo === "retiro" ? "Retiro" : "Entrega"}
                              </Badge>
                            </div>
                            <Button size="sm" variant="ghost" className="h-7 text-xs">
                              <Navigation className="mr-1 h-3 w-3" />
                              Geolocalizar
                            </Button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Shipment Popup */}
          <ShipmentMapPopup
            envio={selectedMapItem?.type === 'envio' ? selectedMapItem.data : null}
            isOpen={selectedMapItem?.type === 'envio'}
            onClose={() => setSelectedMapItem(null)}
            onGeolocate={geocodeEnvio}
            isGeolocating={isGeolocating}
          />

          {/* Branch Popup */}
          <BranchMapPopup
            sucursal={selectedMapItem?.type === 'sucursal' || selectedMapItem?.data?.id === sucursalOrigen?.id ? selectedMapItem?.data : null}
            isOpen={selectedMapItem?.type === 'sucursal' || (selectedMapItem?.type === 'origin' as any)}
            onClose={() => setSelectedMapItem(null)}
            onGeolocate={geocodeSucursal}
            isGeolocating={isGeolocating}
          />

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

                {/* Orden de paradas con drag & drop */}
                {selectedOption && (
                  <Card className="border-dashed">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Orden de Paradas
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          Arrastra para reordenar
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable droppableId="stops">
                          {(provided) => (
                            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 max-h-64 overflow-y-auto">
                              {selectedOption.stops.map((stop, index) => (
                                <Draggable key={stop.envio_id} draggableId={stop.envio_id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                        snapshot.isDragging ? 'bg-primary/10 border-primary shadow-lg' : 'bg-muted/50 hover:bg-muted'
                                      }`}
                                    >
                                      <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                                      </div>
                                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
                                        {index + 1}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                          <Badge variant={stop.tipo === "retiro" ? "secondary" : "default"} className="text-xs">
                                            {stop.tipo === "retiro" ? "Retiro" : "Entrega"}
                                          </Badge>
                                          <span className="font-mono text-xs text-muted-foreground">{stop.tracking}</span>
                                        </div>
                                        <p className="text-sm font-medium truncate">{stop.cliente_nombre}</p>
                                        <p className="text-xs text-muted-foreground truncate">{stop.direccion}</p>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
                    </CardContent>
                  </Card>
                )}

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
                        <Select
                          value={selectedVehiculo || "none"}
                          onValueChange={(v) => setSelectedVehiculo(v === "none" ? "" : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sin asignar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin asignar</SelectItem>
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

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setShowSaveFrequentDialog(true)}
                        disabled={createRouteMutation.isPending}
                      >
                        <Star className="mr-2 h-4 w-4" />
                        Guardar como Frecuente
                      </Button>
                      <Button
                        className="flex-1"
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
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="frecuentes">
          <FrequentRoutesTab 
            enviosPendientes={enviosPendientes}
            onUseRoute={(envioIds, rutaNombre) => {
              setSelectedEnvios(prev => [...new Set([...prev, ...envioIds])]);
              setActiveTab("crear");
              toast.success(`${envioIds.length} envío(s) cargados de "${rutaNombre}"`);
            }}
          />
        </TabsContent>

        <TabsContent value="reprogramados">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Envíos Reprogramados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RescheduledShipmentsList
                selectedEnvios={selectedReprogramados}
                onToggleEnvio={(id) => {
                  setSelectedReprogramados(prev => 
                    prev.includes(id) 
                      ? prev.filter(i => i !== id) 
                      : [...prev, id]
                  );
                }}
                onSelectAll={(ids) => setSelectedReprogramados(ids)}
              />

              {selectedReprogramados.length > 0 && (
                <div className="mt-4 pt-4 border-t flex gap-3">
                  <Button 
                    onClick={() => {
                      // Add to current selection and switch to crear tab
                      setSelectedEnvios(prev => [...new Set([...prev, ...selectedReprogramados])]);
                      setSelectedReprogramados([]);
                      setActiveTab("crear");
                      toast.success(`${selectedReprogramados.length} envío(s) agregados a selección`);
                    }}
                    className="flex-1"
                  >
                    <Navigation className="mr-2 h-4 w-4" />
                    Agregar a Nueva Ruta
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
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
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(ruta.fecha), "dd/MM/yyyy", { locale: es })}
                          </span>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(`/print/planned-route?id=${ruta.id}`, '_blank')}
                          >
                            <Route className="h-4 w-4 mr-1" />
                            Imprimir
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setEditingRoute(ruta)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => setCancellingRoute(ruta)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Cancelar
                          </Button>
                        </div>
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

      {/* Edit Route Dialog */}
      {editingRoute && (
        <EditRouteDialog
          route={editingRoute}
          onClose={() => setEditingRoute(null)}
        />
      )}

      {/* Cancel Route Dialog */}
      {cancellingRoute && (
        <CancelRouteDialog
          route={cancellingRoute}
          onClose={() => setCancellingRoute(null)}
        />
      )}

      {/* Import Shipments Dialog */}
      <ImportShipmentsDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["envios-planificador"] });
        }}
      />

      {/* Save Frequent Route Dialog */}
      {selectedOption && (
        <SaveFrequentRouteDialog
          open={showSaveFrequentDialog}
          onClose={() => setShowSaveFrequentDialog(false)}
          stops={selectedOption.stops}
          envios={selectedEnviosData}
        />
      )}
    </div>
  );
}
