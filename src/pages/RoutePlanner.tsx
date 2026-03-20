import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { parseDateString } from "@/lib/dateUtils";
import { useAuth } from "@/lib/auth";
import { usePersistedState, useClearPersistedState } from "@/hooks/usePersistedState";
import { useSearchParams } from "react-router-dom";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  History,
  RotateCcw,
  X,
  Search,
  CalendarIcon,
  Printer,
} from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import MapView, { MarkerInfo } from "@/components/maps/MapView";
import { ShipmentMapPopup, EnvioData } from "@/components/maps/ShipmentMapPopup";
import { BranchMapPopup } from "@/components/maps/BranchMapPopup";
import { GoogleMapsProvider } from "@/components/maps/GoogleMapsProvider";
import { RouteStatsPanel } from "@/components/maps/RouteStatsPanel";
import { useDriverRoute } from "@/hooks/useDriverRoute";
import EditRouteDialog from "@/components/routes/EditRouteDialog";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, List, MapPinned } from "lucide-react";
import CancelRouteDialog from "@/components/routes/CancelRouteDialog";
import ReopenRouteDialog from "@/components/routes/ReopenRouteDialog";
import ImportShipmentsDialog from "@/components/import/ImportShipmentsDialog";
import RescheduledShipmentsList from "@/components/routes/RescheduledShipmentsList";
import SaveFrequentRouteDialog from "@/components/routes/SaveFrequentRouteDialog";
import FrequentRoutesTab from "@/components/routes/FrequentRoutesTab";
import ThirdPartyShipmentsTab from "@/components/routes/ThirdPartyShipmentsTab";
import EditShipmentLocationDialog from "@/components/routes/EditShipmentLocationDialog";

interface RouteStop {
  envio_id: string;
  sucursal_id?: string;
  tipo: "retiro" | "entrega" | "sucursal";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = usePersistedState('ui-tab-route-planner', "crear");
  // Persist critical selections in sessionStorage to prevent data loss on tab switch
  const [selectedEnvios, setSelectedEnvios] = usePersistedState<string[]>('planner-selected-envios', []);
  const [selectedChofer, setSelectedChofer] = usePersistedState<string>('planner-selected-chofer', "");
  const [selectedVehiculo, setSelectedVehiculo] = usePersistedState<string>('planner-selected-vehiculo', "");
  const [routeDate, setRouteDate] = usePersistedState('planner-route-date', format(new Date(), "yyyy-MM-dd"));
  const [routeStartTime, setRouteStartTime] = usePersistedState('planner-route-time', "09:00");
  const clearPersistedState = useClearPersistedState('planner-selected-envios');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isAIOptimizing, setIsAIOptimizing] = useState(false);
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
  const [urlEnviosProcessed, setUrlEnviosProcessed] = useState(false);
  const [editingLocationEnvio, setEditingLocationEnvio] = useState<EnvioData | null>(null);
  const [groupByCity, setGroupByCity] = useState(false);
  const [selectedSucursales, setSelectedSucursales] = usePersistedState<string[]>('planner-selected-sucursales', []);
  const [reopeningRoute, setReopeningRoute] = useState<any | null>(null);
  const [closingRoute, setClosingRoute] = useState<any | null>(null);
  const [realRoutePolyline, setRealRoutePolyline] = useState<{ lat: number; lng: number }[]>([]);
  const [isClosingRoute, setIsClosingRoute] = useState(false);
  
  // History tab state
  const [historyDateFrom, setHistoryDateFrom] = useState<Date | undefined>(undefined);
  const [historyDateTo, setHistoryDateTo] = useState<Date | undefined>(undefined);
  const [historySearch, setHistorySearch] = useState("");
  const [showHistoryRouteDialog, setShowHistoryRouteDialog] = useState(false);
  const [selectedHistoryRoute, setSelectedHistoryRoute] = useState<any | null>(null);
  
  // GPS route visualization
  const driverRoute = useDriverRoute();

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
        .in("estado", ["pendiente", "recogido", "en_sucursal"])
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
      // IDs explicitly selected from ecommerce module via URL
      const urlEnvioIdsArray = (searchParams.get('envios') || '').split(',').filter(Boolean);
      const urlEnvioIds = new Set(urlEnvioIdsArray);

      // Query 1: standard pending shipments without driver
      const query = supabase
        .from("envios")
        .select(`
          *,
          remitente:clientes!envios_remitente_id_fkey(nombre, apellido, direccion, ciudad, telefono),
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, direccion, ciudad, telefono)
        `)
        .in("estado", ["pendiente", "recogido", "en_sucursal", "en_reparto"])
        .is("chofer_id", null)
        .order("created_at", { ascending: false });

      // Filter by sucursal if not admin
      if (!roles.includes("admin") && !roles.includes("supervisor") && profile?.sucursal_id) {
        query.or(`sucursal_origen_id.eq.${profile.sucursal_id},sucursal_destino_id.eq.${profile.sucursal_id}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Query 2: shipments from URL (bypass chofer_id filter)
      let urlShipments: typeof data = [];
      if (urlEnvioIdsArray.length > 0) {
        const { data: urlData, error: urlError } = await supabase
          .from("envios")
          .select(`
            *,
            remitente:clientes!envios_remitente_id_fkey(nombre, apellido, direccion, ciudad, telefono),
            destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, direccion, ciudad, telefono)
          `)
          .in("id", urlEnvioIdsArray)
          .in("estado", ["pendiente", "recogido", "en_sucursal", "en_reparto"]);
        if (urlError) throw urlError;
        urlShipments = urlData || [];
      }

      // Merge results, removing duplicates (URL shipments take priority)
      const existingIds = new Set((data || []).map(e => e.id));
      const merged = [
        ...(data || []),
        ...urlShipments.filter(e => !existingIds.has(e.id)),
      ];

      // Filter out ML shipments still in 'pendiente' (not yet collected)
      const filtered = merged.filter(envio => {
        // URL-specified shipments always visible
        if (urlEnvioIds.has(envio.id)) return true;
        // Rescheduled shipments always visible
        if ((envio.reprogramado_count && envio.reprogramado_count > 0) || envio.ultima_reprogramacion) return true;
        // Hide ML shipments that are still pendiente (not yet collected)
        if (envio.ml_shipment_id && envio.estado === 'pendiente') return false;
        // Everything else visible
        return true;
      });

      // Map to include type (retiro/entrega)
      return filtered.map(envio => ({
        ...envio,
        tipo: envio.requiere_retiro && envio.estado === "pendiente" ? "retiro" : "entrega",
        coords: envio.requiere_retiro && envio.estado === "pendiente"
          ? { lat: envio.remitente_lat, lng: envio.remitente_lng }
          : { lat: envio.entrega_lat || envio.destinatario_lat, lng: envio.entrega_lng || envio.destinatario_lng },
      }));
    },
  });

  // Preselect envios from URL query params (from e-commerce orders page)
  useEffect(() => {
    if (urlEnviosProcessed) return;
    
    const enviosParam = searchParams.get('envios');
    if (enviosParam && enviosPendientes.length > 0) {
      const envioIds = enviosParam.split(',').filter(Boolean);
      
      // Filter to only include valid envío IDs that exist in the pending list
      const validIds = envioIds.filter(id => 
        enviosPendientes.some(e => e.id === id)
      );
      
      if (validIds.length > 0) {
        setSelectedEnvios(validIds);
        toast.success(`${validIds.length} envíos preseleccionados`, {
          description: 'Listos para optimizar y crear ruta'
        });
        
        // Clear URL param to prevent re-selection on page refresh
        setSearchParams({}, { replace: true });
      } else if (envioIds.length > 0) {
        toast.warning('Envíos no disponibles', {
          description: 'Algunos envíos ya fueron asignados o no están disponibles'
        });
        setSearchParams({}, { replace: true });
      }
      
      setUrlEnviosProcessed(true);
    }
  }, [enviosPendientes, searchParams, urlEnviosProcessed, setSelectedEnvios, setSearchParams]);

  // Fetch choferes
  const { data: choferes = [] } = useQuery({
    queryKey: ["choferes-planificador", profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];
      
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
        .eq("tenant_id", profile.tenant_id)
        .eq("activo", true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.tenant_id,
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

  // Fetch completed routes for history tab with GPS data check
  const { data: rutasHistorial = [], isLoading: loadingHistorial } = useQuery({
    queryKey: ["rutas-historial", historyDateFrom?.toISOString(), historyDateTo?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("rutas_planificadas")
        .select(`
          *,
          sucursal:sucursales(nombre)
        `)
        .eq("estado", "completada")
        .order("created_at", { ascending: false })
        .limit(100);
      
      // Apply date filters
      if (historyDateFrom) {
        query = query.gte("created_at", startOfDay(historyDateFrom).toISOString());
      }
      if (historyDateTo) {
        query = query.lte("created_at", endOfDay(historyDateTo).toISOString());
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch driver profiles
      const driverIds = [...new Set(data?.map(r => r.chofer_id).filter(Boolean) || [])];
      let profiles: any[] = [];
      if (driverIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, nombre, apellido")
          .in("user_id", driverIds);
        profiles = profs || [];
      }
      
      // Check which routes have GPS history
      const rutaIds = data?.map(r => r.id) || [];
      let gpsHistoryMap: Record<string, boolean> = {};
      
      if (rutaIds.length > 0) {
        const { data: gpsData } = await supabase
          .from("driver_location_history")
          .select("ruta_id")
          .in("ruta_id", rutaIds);
        
        if (gpsData) {
          const rutaIdsWithHistory = new Set(gpsData.map(g => g.ruta_id));
          gpsHistoryMap = rutaIds.reduce((acc, id) => {
            acc[id] = rutaIdsWithHistory.has(id);
            return acc;
          }, {} as Record<string, boolean>);
        }
      }
      
      return data?.map(ruta => ({
        ...ruta,
        chofer_profile: profiles.find(p => p.user_id === ruta.chofer_id),
        has_gps_history: gpsHistoryMap[ruta.id] || false,
      })) || [];
    },
  });

  // Filter history routes by search term
  const filteredHistorial = useMemo(() => {
    if (!historySearch.trim()) return rutasHistorial;
    const term = historySearch.toLowerCase();
    return rutasHistorial.filter(ruta =>
      ruta.numero?.toLowerCase().includes(term) ||
      ruta.chofer_profile?.nombre?.toLowerCase().includes(term) ||
      ruta.chofer_profile?.apellido?.toLowerCase().includes(term) ||
      ruta.sucursal?.nombre?.toLowerCase().includes(term)
    );
  }, [rutasHistorial, historySearch]);

  // Handle viewing route GPS history
  const handleViewHistoryRoute = async (ruta: any) => {
    if (!ruta.chofer_id) {
      toast.error("Esta ruta no tiene chofer asignado");
      return;
    }
    
    setSelectedHistoryRoute(ruta);
    setShowHistoryRouteDialog(true);
    
    // Load the route GPS data
    await driverRoute.loadRoute(ruta.chofer_id, ruta.id);
  };

  // Clear history date filters
  const clearHistoryDateFilters = () => {
    setHistoryDateFrom(undefined);
    setHistoryDateTo(undefined);
  };
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
        const isRetiro = envio.tipo === "retiro";
        const updateFields: Record<string, number> = isRetiro
          ? { remitente_lat: response.data.lat, remitente_lng: response.data.lng }
          : { 
              destinatario_lat: response.data.lat, 
              destinatario_lng: response.data.lng,
              entrega_lat: response.data.lat,
              entrega_lng: response.data.lng,
            };
        
        const { error } = await supabase
          .from("envios")
          .update(updateFields)
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
    
    // 3. If optimized route, delivery stops are shown via routeDeliveryStops (DeliveryStopMarker with order numbers)
    // Do NOT add standard markers here to avoid overlapping/hiding the numbered stops
    if (selectedOption) {
      // Only routeDeliveryStops will render the numbered markers
    } else {
      // 4. Show all selected shipments (with and without coords)
      selectedEnviosData.forEach((envio, index) => {
        const hasCoords = envio.coords?.lat && envio.coords?.lng;
        
        if (hasCoords) {
          markers.push({
            id: envio.id,
            position: { lat: Number(envio.coords.lat), lng: Number(envio.coords.lng) },
            title: `${index + 1}. ${envio.tracking_externo || envio.tracking_number}`,
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

  // Fetch real road polyline from Google Directions API
  useEffect(() => {
    if (!selectedOption || !window.google?.maps) {
      setRealRoutePolyline([]);
      return;
    }

    const stops = selectedOption.stops.filter(s => s.lat && s.lng);
    if (stops.length === 0) {
      setRealRoutePolyline([]);
      return;
    }

    const originLatLng = sucursalOrigen?.lat && sucursalOrigen?.lng
      ? { lat: Number(sucursalOrigen.lat), lng: Number(sucursalOrigen.lng) }
      : null;

    const allPoints = [
      ...(originLatLng ? [originLatLng] : []),
      ...stops.map(s => ({ lat: s.lat, lng: s.lng })),
    ];

    if (allPoints.length < 2) {
      setRealRoutePolyline([]);
      return;
    }

    const directionsService = new google.maps.DirectionsService();
    const MAX_WAYPOINTS = 23;

    const fetchDirections = async () => {
      try {
        const fullPath: google.maps.LatLng[] = [];
        let totalDistMeters = 0;
        let totalDurSeconds = 0;

        let startIdx = 0;
        while (startIdx < allPoints.length - 1) {
          const chunkOrigin = allPoints[startIdx];
          const endIdx = Math.min(startIdx + MAX_WAYPOINTS + 1, allPoints.length - 1);
          const chunkDest = allPoints[endIdx];
          const waypointPoints = allPoints.slice(startIdx + 1, endIdx);

          const waypoints = waypointPoints.map(p => ({
            location: new google.maps.LatLng(p.lat, p.lng),
            stopover: true,
          }));

          const result = await new Promise<google.maps.DirectionsResult | null>((resolve) => {
            directionsService.route(
              {
                origin: new google.maps.LatLng(chunkOrigin.lat, chunkOrigin.lng),
                destination: new google.maps.LatLng(chunkDest.lat, chunkDest.lng),
                waypoints,
                optimizeWaypoints: false,
                travelMode: google.maps.TravelMode.DRIVING,
              },
              (res, status) => {
                resolve(status === google.maps.DirectionsStatus.OK && res ? res : null);
              }
            );
          });

          if (result?.routes?.[0]) {
            const route = result.routes[0];
            const path = route.overview_path;
            if (fullPath.length > 0) {
              fullPath.push(...path.slice(1));
            } else {
              fullPath.push(...path);
            }
            if (route.legs) {
              route.legs.forEach(leg => {
                totalDistMeters += leg.distance?.value || 0;
                totalDurSeconds += leg.duration?.value || 0;
              });
            }
          } else {
            for (let i = startIdx; i <= endIdx; i++) {
              fullPath.push(new google.maps.LatLng(allPoints[i].lat, allPoints[i].lng));
            }
          }

          startIdx = endIdx;
        }

        setRealRoutePolyline(fullPath.map(p => ({ lat: p.lat(), lng: p.lng() })));

        if (totalDistMeters > 0) {
          setSelectedOption(prev => prev ? {
            ...prev,
            totalDistance: Math.round(totalDistMeters / 100) / 10,
            estimatedTime: Math.round(totalDurSeconds / 360) / 10,
          } : prev);
        }
      } catch (err) {
        console.error('Error fetching real route polyline:', err);
        setRealRoutePolyline([]);
      }
    };

    fetchDirections();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOption?.stops, sucursalOrigen]);

  // Delivery stop markers for route traceability
  const routeDeliveryStops = useMemo(() => {
    if (!selectedOption) return [];
    return selectedOption.stops.map((stop, index) => ({
      position: { lat: stop.lat, lng: stop.lng },
      time: stop.tipo === 'sucursal' ? '🏢' : stop.tipo === 'retiro' ? '🏠' : '📦',
      trackingNumber: stop.tracking || stop.cliente_nombre,
      order: index + 1,
      type: (stop.tipo === 'retiro' || stop.tipo === 'sucursal') ? stop.tipo : 'entrega' as 'retiro' | 'entrega' | 'sucursal',
    }));
  }, [selectedOption]);

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
    if (selectedEnvios.length === 0 && selectedSucursales.length === 0) {
      toast.error("Selecciona al menos 1 envío o sucursal");
      return;
    }

    // Advertencia si la sucursal no tiene coordenadas
    if (!sucursalOrigen?.lat || !sucursalOrigen?.lng) {
      toast.warning("La sucursal de origen no tiene coordenadas. Se usará ubicación por defecto.");
    }

    setIsOptimizing(true);

    try {
      // Starting point from user's sucursal
      const originLat = sucursalOrigen?.lat ? Number(sucursalOrigen.lat) : -34.6037;
      const originLng = sucursalOrigen?.lng ? Number(sucursalOrigen.lng) : -58.3816;

      // CASO ESPECIAL: Solo 1 envío - crear ruta directa sin optimización
      if (selectedEnvios.length === 1) {
        const envio = selectedEnviosData[0];
        if (!envio.coords?.lat || !envio.coords?.lng) {
          toast.error("El envío no tiene coordenadas. Geolocalizalo primero.");
          setIsOptimizing(false);
          return;
        }
        
        const singleStop: RouteStop = {
          envio_id: envio.id,
          tipo: envio.tipo as "retiro" | "entrega",
          direccion: envio.tipo === "retiro" 
            ? (envio.direccion_retiro || envio.remitente?.direccion || "")
            : (envio.direccion_entrega || envio.destinatario?.direccion || ""),
          lat: Number(envio.coords.lat),
          lng: Number(envio.coords.lng),
          cliente_nombre: envio.tipo === "retiro" 
            ? (envio.nombre_remitente || `${envio.remitente?.nombre || ''} ${envio.remitente?.apellido || ''}`.trim())
            : (envio.nombre_destinatario || `${envio.destinatario?.nombre || ''} ${envio.destinatario?.apellido || ''}`.trim()),
          telefono: envio.tipo === "retiro" ? (envio.remitente?.telefono || "") : (envio.destinatario?.telefono || ""),
          tracking: envio.tracking_externo || envio.tracking_number,
        };
        
        const distancia = calcDistance(originLat, originLng, singleStop.lat, singleStop.lng) * 1.3;
        
        const singleOption: RouteOption = {
          name: envio.tipo === "retiro" ? "🏠 Retiro único" : "📦 Entrega única",
          stops: [singleStop],
          totalDistance: Math.round(distancia * 10) / 10,
          estimatedTime: Math.round((distancia / 25 + 0.1) * 10) / 10,
          reasoning: "Ruta directa desde la sucursal al punto de " + (envio.tipo === "retiro" ? "retiro" : "entrega"),
        };
        
        setRouteOptions([singleOption]);
        setSelectedOption(singleOption);
        setIsOptimizing(false);
        toast.success("Ruta preparada");
        return;
      }

      // CASO NORMAL: 2+ stops - optimizar
      // Build sucursal stops
      const sucursalStops = selectedSucursales
        .map(sId => sucursalesConEnvios.find(s => s.id === sId))
        .filter(s => s && s.lat && s.lng)
        .map(s => ({
          id: s!.id,
          tipo: "sucursal" as const,
          coords: { lat: Number(s!.lat), lng: Number(s!.lng) },
          direccion: s!.direccion || '',
          ciudad: s!.ciudad || '',
          nombre: s!.nombre,
          tracking_number: '',
          _isSucursal: true,
        }));

      const enviosConCoords = [
        ...selectedEnviosData.filter(e => e.coords?.lat && e.coords?.lng),
        ...sucursalStops,
      ];

      if (enviosConCoords.length < 2) {
        // Single stop case
        const singleItem = enviosConCoords[0];
        if (!singleItem) {
          toast.error("Los envíos/sucursales seleccionados no tienen coordenadas suficientes");
          setIsOptimizing(false);
          return;
        }
        const isSuc = (singleItem as any)._isSucursal;
        const singleStop: RouteStop = {
          envio_id: isSuc ? '' : singleItem.id,
          sucursal_id: isSuc ? singleItem.id : undefined,
          tipo: isSuc ? 'sucursal' : (singleItem as any).tipo,
          direccion: isSuc ? (singleItem as any).direccion : ((singleItem as any).tipo === "retiro" 
            ? ((singleItem as any).direccion_retiro || (singleItem as any).remitente?.direccion || "")
            : ((singleItem as any).direccion_entrega || (singleItem as any).destinatario?.direccion || "")),
          lat: Number(singleItem.coords!.lat),
          lng: Number(singleItem.coords!.lng),
          cliente_nombre: isSuc ? (singleItem as any).nombre : ((singleItem as any).tipo === "retiro"
            ? ((singleItem as any).nombre_remitente || `${(singleItem as any).remitente?.nombre || ''} ${(singleItem as any).remitente?.apellido || ''}`.trim())
            : ((singleItem as any).nombre_destinatario || `${(singleItem as any).destinatario?.nombre || ''} ${(singleItem as any).destinatario?.apellido || ''}`.trim())),
          telefono: isSuc ? '' : ((singleItem as any).tipo === "retiro" ? ((singleItem as any).remitente?.telefono || "") : ((singleItem as any).destinatario?.telefono || "")),
          tracking: isSuc ? '' : ((singleItem as any).tracking_externo || (singleItem as any).tracking_number),
        };
        const distancia = calcDistance(originLat, originLng, singleStop.lat, singleStop.lng) * 1.3;
        const singleOption: RouteOption = {
          name: isSuc ? "🏢 Sucursal" : ((singleItem as any).tipo === "retiro" ? "🏠 Retiro único" : "📦 Entrega única"),
          stops: [singleStop],
          totalDistance: Math.round(distancia * 10) / 10,
          estimatedTime: Math.round((distancia / 25 + 0.1) * 10) / 10,
          reasoning: "Ruta directa",
        };
        setRouteOptions([singleOption]);
        setSelectedOption(singleOption);
        setIsOptimizing(false);
        toast.success("Ruta preparada");
        return;
      }

      // Nearest neighbor algorithm
      const nearestNeighbor = (stops: any[], startLatParam: number, startLngParam: number) => {
        const remaining = [...stops];
        const ordered: any[] = [];
        let currentLat = startLatParam;
        let currentLng = startLngParam;
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

      // Helper to map a stop from the NN result
      const mapStop = (e: any): RouteStop => {
        if (e._isSucursal) {
          return {
            envio_id: '',
            sucursal_id: e.id,
            tipo: 'sucursal',
            direccion: e.direccion,
            lat: Number(e.coords.lat),
            lng: Number(e.coords.lng),
            cliente_nombre: e.nombre,
            telefono: '',
            tracking: '',
          };
        }
        return {
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
          tracking: e.tracking_externo || e.tracking_number,
        };
      };

      // Option 1: Pickups first, then deliveries, sucursales mixed in
      const retiros = enviosConCoords.filter(e => (e as any).tipo === "retiro");
      const entregas = enviosConCoords.filter(e => (e as any).tipo === "entrega");
      const sucursalesInRoute = enviosConCoords.filter(e => (e as any)._isSucursal);
      
      const retirosOpt = nearestNeighbor(retiros, originLat, originLng);
      const lastRetiro = retirosOpt.ordered.length > 0 
        ? retirosOpt.ordered[retirosOpt.ordered.length - 1] 
        : { coords: { lat: originLat, lng: originLng } };
      const entregasYSucursales = [...entregas, ...sucursalesInRoute];
      const entregasOpt = nearestNeighbor(entregasYSucursales, Number(lastRetiro.coords.lat), Number(lastRetiro.coords.lng));
      
      const option1Distance = retirosOpt.totalDistance + entregasOpt.totalDistance;
      const option1Stops = [...retirosOpt.ordered, ...entregasOpt.ordered].map(mapStop);

      // Option 2: All mixed by nearest neighbor
      const allMixed = nearestNeighbor(enviosConCoords, originLat, originLng);
      const option2Stops = allMixed.ordered.map(mapStop);

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

      // Trigger AI optimization in background
      setIsAIOptimizing(true);
      try {
        const aiStops = enviosConCoords.map((e, idx) => ({
          index: idx,
          lat: Number(e.coords!.lat),
          lng: Number(e.coords!.lng),
          tipo: (e as any)._isSucursal ? "sucursal" : (e as any).tipo,
          direccion: (e as any)._isSucursal ? (e as any).direccion : (
            (e as any).tipo === "retiro" 
              ? ((e as any).direccion_retiro || (e as any).remitente?.direccion || "")
              : ((e as any).direccion_entrega || (e as any).destinatario?.direccion || "")
          ),
          horario_preferido: (e as any).horario_preferido_entrega || "cualquier_hora",
          ciudad: (e as any)._isSucursal ? (e as any).ciudad : (
            (e as any).tipo === "retiro"
              ? ((e as any).ciudad_retiro || (e as any).remitente?.ciudad || "")
              : ((e as any).ciudad_entrega || (e as any).destinatario?.ciudad || "")
          ),
        }));

        const { data: aiData, error: aiError } = await supabase.functions.invoke('optimize-route', {
          body: {
            stops: aiStops,
            origin: { lat: originLat, lng: originLng },
          },
        });

        if (aiError) throw aiError;
        if (aiData?.error) throw new Error(aiData.error);

        const aiOrderedStops = (aiData.ordered_indices as number[]).map(
          (idx: number) => mapStop(enviosConCoords[idx])
        );
        const aiDistance = calculateTotalDistance(aiOrderedStops);
        const aiTime = Math.round((aiDistance / 25 + aiOrderedStops.length * 0.1) * 10) / 10;

        const aiOption: RouteOption = {
          name: "🧠 Optimizada con IA",
          stops: aiOrderedStops,
          totalDistance: aiDistance,
          estimatedTime: aiTime,
          reasoning: aiData.reasoning || "Ruta optimizada por IA considerando zonas, horarios y tipo de parada.",
        };

        setRouteOptions(prev => [...prev, aiOption]);
        toast.success("Opción IA disponible", { description: "Se agregó una tercera opción optimizada con inteligencia artificial." });
      } catch (aiErr: any) {
        console.error("AI optimization failed:", aiErr);
        // Don't show error toast for rate limits, show specific message
        const msg = aiErr?.message || "";
        if (msg.includes("429") || msg.includes("límite")) {
          toast.info("Optimización IA no disponible temporalmente", { description: "Se están usando las opciones locales." });
        } else if (msg.includes("402") || msg.includes("créditos")) {
          toast.info("Créditos de IA agotados", { description: "Se están usando las opciones locales." });
        }
        // Silently fail - local options are already available
      } finally {
        setIsAIOptimizing(false);
      }

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
        envio_id: stop.envio_id || null,
        sucursal_id: stop.sucursal_id || null,
        nombre_parada: stop.tipo === 'sucursal' ? stop.cliente_nombre : null,
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

      // Update shipments with driver (only envio stops)
      const chofer = choferes.find(c => c.user_id === selectedChofer);
      const envioIds = selectedOption.stops
        .filter(s => s.envio_id)
        .map(s => s.envio_id);

      if (envioIds.length > 0) {
        const { error: updateError } = await supabase
          .from("envios")
          .update({
            chofer_id: selectedChofer,
            estado: "en_reparto",
          })
          .in("id", envioIds);

        if (updateError) throw updateError;
      }

      // Notify driver about new route assignment
      try {
        await supabase.functions.invoke("notify-driver-route", {
          body: {
            type: "route_assigned",
            driver_id: selectedChofer,
            route_id: ruta.id,
            route_number: ruta.numero,
            tenant_id: profile?.tenant_id,
            shipment_count: selectedOption.stops.filter(s => s.tipo === "entrega").length,
          },
        });
      } catch (notifErr) {
        console.warn("Failed to notify driver:", notifErr);
      }

      return ruta;
    },
    onSuccess: (ruta) => {
      queryClient.invalidateQueries({ queryKey: ["envios-planificador"] });
      queryClient.invalidateQueries({ queryKey: ["rutas-activas"] });
      toast.success(`Ruta ${ruta.numero} creada exitosamente`);
      
      // Reset form
      setSelectedEnvios([]);
      setSelectedSucursales([]);
      setRouteOptions([]);
      setSelectedOption(null);
      setSelectedChofer("");
      setSelectedVehiculo("");
      
      // Clear persisted state after successful creation
      clearPersistedState();
      
      setActiveTab("activas");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al crear la ruta");
    },
  });

  const retirosCount = filteredEnvios.filter(e => e.tipo === "retiro").length;
  const entregasCount = filteredEnvios.filter(e => e.tipo === "entrega").length;

  // Group envios by city
  const groupedEnvios = useMemo(() => {
    const groups: Record<string, typeof filteredEnvios> = {};
    filteredEnvios.forEach(envio => {
      const city = envio.tipo === "retiro"
        ? (envio.ciudad_retiro || envio.remitente?.ciudad || 'Sin localidad')
        : (envio.ciudad_entrega || envio.destinatario?.ciudad || 'Sin localidad');
      if (!groups[city]) groups[city] = [];
      groups[city].push(envio);
    });
    // Sort groups by count descending
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredEnvios]);

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
        <TabsList className="flex-wrap">
          <TabsTrigger value="crear">
            <Navigation className="mr-2 h-4 w-4" />
            Crear Ruta
          </TabsTrigger>
          <TabsTrigger value="frecuentes">
            <Star className="mr-2 h-4 w-4" />
            Frecuentes
          </TabsTrigger>
          <TabsTrigger value="terciarizados">
            <Truck className="mr-2 h-4 w-4" />
            Terciarizados
          </TabsTrigger>
          <TabsTrigger value="reprogramados">
            <CalendarClock className="mr-2 h-4 w-4" />
            Reprogramados
          </TabsTrigger>
          <TabsTrigger value="activas">
            <PlayCircle className="mr-2 h-4 w-4" />
            Rutas Activas ({rutasActivas.length})
          </TabsTrigger>
          <TabsTrigger value="historial">
            <History className="mr-2 h-4 w-4" />
            Historial
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
                    <div className="flex border rounded-md overflow-hidden">
                      <Button
                        variant={!groupByCity ? "default" : "ghost"}
                        size="sm"
                        className="rounded-none h-8 px-2"
                        onClick={() => setGroupByCity(false)}
                      >
                        <List className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant={groupByCity ? "default" : "ghost"}
                        size="sm"
                        className="rounded-none h-8 px-2"
                        onClick={() => setGroupByCity(true)}
                      >
                        <MapPinned className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
                ) : groupByCity ? (
                  <div className="max-h-80 overflow-y-auto space-y-1">
                    {groupedEnvios.map(([city, envios]) => {
                      const allSelected = envios.every(e => selectedEnvios.includes(e.id));
                      const someSelected = envios.some(e => selectedEnvios.includes(e.id));
                      return (
                        <Collapsible key={city} defaultOpen>
                          <div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50">
                            <Checkbox
                              checked={allSelected}
                              className={someSelected && !allSelected ? "opacity-50" : ""}
                              onCheckedChange={(checked) => {
                                const ids = envios.map(e => e.id);
                                if (checked) {
                                  setSelectedEnvios(prev => [...new Set([...prev, ...ids])]);
                                } else {
                                  setSelectedEnvios(prev => prev.filter(id => !ids.includes(id)));
                                }
                                setRouteOptions([]);
                                setSelectedOption(null);
                              }}
                            />
                            <CollapsibleTrigger className="group flex items-center gap-2 flex-1 text-left">
                              <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                              <span className="text-sm font-medium">{city}</span>
                              <Badge variant="outline" className="text-xs">{envios.length}</Badge>
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent>
                            <div className="pl-8 space-y-1 pb-1">
                              {envios.map(envio => (
                                <div
                                  key={envio.id}
                                  className="flex items-center gap-2 p-1.5 rounded text-sm hover:bg-muted/30 cursor-pointer"
                                  onClick={() => toggleEnvio(envio.id)}
                                >
                                  <Checkbox
                                    checked={selectedEnvios.includes(envio.id)}
                                    onCheckedChange={() => toggleEnvio(envio.id)}
                                  />
                                  <span className="font-mono text-xs">{envio.tracking_externo || envio.tracking_number}</span>
                                  <Badge variant={envio.tipo === "retiro" ? "secondary" : "default"} className="text-xs h-5">
                                    {envio.tipo === "retiro" ? "Retiro" : "Entrega"}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground truncate">
                                    {envio.tipo === "retiro"
                                      ? (envio.direccion_retiro || envio.remitente?.direccion)
                                      : (envio.direccion_entrega || envio.destinatario?.direccion)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
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
                  </div>
                )}

                {/* Sucursales en Ruta */}
                {sucursalesConEnvios.filter(s => s.id !== sucursalOrigen?.id && s.lat && s.lng).length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Sucursales en Ruta
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Agrega sucursales como paradas intermedias (recoger/dejar paquetes)
                    </p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {sucursalesConEnvios
                        .filter(s => s.id !== sucursalOrigen?.id && s.lat && s.lng)
                        .map(sucursal => (
                          <div
                            key={sucursal.id}
                            className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                            onClick={() => {
                              setSelectedSucursales(prev =>
                                prev.includes(sucursal.id)
                                  ? prev.filter(id => id !== sucursal.id)
                                  : [...prev, sucursal.id]
                              );
                              setRouteOptions([]);
                              setSelectedOption(null);
                            }}
                          >
                            <Checkbox
                              checked={selectedSucursales.includes(sucursal.id)}
                              onCheckedChange={() => {
                                setSelectedSucursales(prev =>
                                  prev.includes(sucursal.id)
                                    ? prev.filter(id => id !== sucursal.id)
                                    : [...prev, sucursal.id]
                                );
                                setRouteOptions([]);
                                setSelectedOption(null);
                              }}
                            />
                            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium">{sucursal.nombre}</span>
                              {sucursal.ciudad && (
                                <span className="text-xs text-muted-foreground ml-2">{sucursal.ciudad}</span>
                              )}
                            </div>
                            {sucursal.enviosCount > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {sucursal.enviosCount} envíos
                              </Badge>
                            )}
                          </div>
                        ))}
                    </div>
                    {selectedSucursales.length > 0 && (
                      <p className="text-xs text-primary mt-2">
                        {selectedSucursales.length} sucursal(es) incluida(s)
                      </p>
                    )}
                  </div>
                )}

                {(selectedEnvios.length > 0 || selectedSucursales.length > 0) && (
                  <div className="mt-4">
                    <Button 
                      className="w-full" 
                      onClick={optimizeRoute}
                      disabled={isOptimizing || (selectedEnvios.length < 1 && selectedSucursales.length < 1)}
                    >
                      {isOptimizing ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Optimizando...</>
                      ) : selectedEnvios.length <= 1 && selectedSucursales.length === 0 ? (
                        <><Navigation className="mr-2 h-4 w-4" />Preparar Ruta</>
                      ) : (
                        <><Zap className="mr-2 h-4 w-4" />Optimizar Ruta ({selectedEnvios.length} envíos{selectedSucursales.length > 0 ? ` + ${selectedSucursales.length} sucursales` : ''})</>
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
                    polylinePath={realRoutePolyline.length > 0 ? realRoutePolyline : routePolyline}
                    useGradient={!!selectedOption}
                    deliveryStops={routeDeliveryStops}
                    center={
                      mapMarkers.length === 0 && routeDeliveryStops.length === 0
                        ? (sucursalOrigen?.lat && sucursalOrigen?.lng 
                            ? { lat: Number(sucursalOrigen.lat), lng: Number(sucursalOrigen.lng) }
                            : { lat: -34.6037, lng: -58.3816 })
                        : undefined
                    }
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
            onEditLocation={(envio) => {
              setEditingLocationEnvio(envio);
              setSelectedMapItem(null);
            }}
            isGeolocating={isGeolocating}
          />

          {/* Edit Location Dialog */}
          <EditShipmentLocationDialog
            envio={editingLocationEnvio}
            isOpen={!!editingLocationEnvio}
            onClose={() => setEditingLocationEnvio(null)}
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
                {/* Optimization savings panel */}
                {routeOptions.length >= 2 && (
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <h4 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Impacto de la optimización
                    </h4>
                    {(() => {
                      const worst = Math.max(...routeOptions.map(o => o.totalDistance));
                      const best = Math.min(...routeOptions.map(o => o.totalDistance));
                      const savedKm = Math.round((worst - best) * 10) / 10;
                      const savedPct = worst > 0 ? Math.round((savedKm / worst) * 100) : 0;
                      const worstTime = Math.max(...routeOptions.map(o => o.estimatedTime));
                      const bestTime = Math.min(...routeOptions.map(o => o.estimatedTime));
                      const savedTime = Math.round((worstTime - bestTime) * 10) / 10;
                      const fuelSaved = Math.round(savedKm * 0.08 * 10) / 10; // ~0.08 L/km estimate
                      return (
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div>
                            <p className="text-xl font-bold text-foreground">{savedKm} km</p>
                            <p className="text-xs text-muted-foreground">menos distancia</p>
                            <Badge variant="secondary" className="mt-1 text-xs">-{savedPct}%</Badge>
                          </div>
                          <div>
                            <p className="text-xl font-bold text-foreground">{savedTime} hs</p>
                            <p className="text-xs text-muted-foreground">tiempo ahorrado</p>
                          </div>
                          <div>
                            <p className="text-xl font-bold text-foreground">~{fuelSaved} L</p>
                            <p className="text-xs text-muted-foreground">combustible est.</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  {isAIOptimizing && (
                    <div className="border rounded-lg p-4 border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-sm font-medium">Optimizando con IA...</span>
                      <span className="text-xs">Analizando zonas y horarios</span>
                    </div>
                  )}
                </div>

                {/* Orden de paradas con drag & drop + mapa lado a lado */}
                {selectedOption && (
                  <div className="grid lg:grid-cols-2 gap-4">
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
                              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 max-h-[420px] overflow-y-auto">
                                {selectedOption.stops.map((stop, index) => {
                                  const stopKey = stop.sucursal_id || stop.envio_id;
                                  return (
                                  <Draggable key={stopKey} draggableId={stopKey} index={index}>
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
                                            <Badge variant={stop.tipo === "retiro" ? "secondary" : stop.tipo === "sucursal" ? "outline" : "default"} className="text-xs">
                                              {stop.tipo === "retiro" ? "Retiro" : stop.tipo === "sucursal" ? (<><Building2 className="mr-1 h-3 w-3" />Sucursal</>) : "Entrega"}
                                            </Badge>
                                            {stop.tracking && <span className="font-mono text-xs text-muted-foreground">{stop.tracking}</span>}
                                          </div>
                                          <p className="text-sm font-medium truncate">{stop.cliente_nombre}</p>
                                          <p className="text-xs text-muted-foreground truncate">{stop.direccion}</p>
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                  );
                                })}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </DragDropContext>
                      </CardContent>
                    </Card>

                    {/* Mapa reactivo al lado */}
                    <div className="h-[500px] rounded-lg overflow-hidden border">
                      <MapView
                        markers={mapMarkers}
                        polylinePath={realRoutePolyline.length > 0 ? realRoutePolyline : routePolyline}
                        useGradient={!!selectedOption}
                        deliveryStops={routeDeliveryStops}
                        center={
                          mapMarkers.length === 0 && routeDeliveryStops.length === 0
                            ? (sucursalOrigen?.lat && sucursalOrigen?.lng 
                                ? { lat: Number(sucursalOrigen.lat), lng: Number(sucursalOrigen.lng) }
                                : undefined)
                            : undefined
                        }
                        height="100%"
                        onMarkerClick={handleMarkerClick}
                      />
                    </div>
                  </div>
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

        <TabsContent value="terciarizados">
          <ThirdPartyShipmentsTab />
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
                            {format(parseDateString(ruta.fecha), "dd/MM/yyyy", { locale: es })}
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
                          {(roles.includes('admin') || roles.includes('super_admin')) && (ruta.estado === 'en_curso' || (ruta.estado === 'confirmada' && new Date(ruta.fecha) < startOfDay(new Date()))) && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setClosingRoute(ruta)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Cerrar Ruta
                            </Button>
                          )}
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

        <TabsContent value="historial" className="space-y-4">
          {/* Search and Date Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, chofer o sucursal..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Date From */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[160px] justify-start text-left font-normal",
                    !historyDateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {historyDateFrom ? format(historyDateFrom, "dd/MM/yyyy", { locale: es }) : "Desde"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={historyDateFrom}
                  onSelect={setHistoryDateFrom}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            
            {/* Date To */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[160px] justify-start text-left font-normal",
                    !historyDateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {historyDateTo ? format(historyDateTo, "dd/MM/yyyy", { locale: es }) : "Hasta"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={historyDateTo}
                  onSelect={setHistoryDateTo}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            
            {/* Clear Filters */}
            {(historyDateFrom || historyDateTo) && (
              <Button variant="ghost" size="icon" onClick={clearHistoryDateFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Routes List */}
          {loadingHistorial ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="h-20 bg-muted" />
                  <CardContent className="h-32 bg-muted/50" />
                </Card>
              ))}
            </div>
          ) : filteredHistorial.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <History className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">No hay rutas en el historial</h3>
                <p className="text-sm text-muted-foreground">
                  {historyDateFrom || historyDateTo 
                    ? "No se encontraron rutas completadas en el rango de fechas seleccionado" 
                    : "Las rutas completadas aparecerán aquí"
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredHistorial.map(ruta => (
                <Card key={ruta.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-mono">{ruta.numero}</CardTitle>
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        Completada
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Driver info */}
                    {ruta.chofer_profile && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {ruta.chofer_profile.nombre} {ruta.chofer_profile.apellido}
                        </span>
                        {ruta.has_gps_history && (
                          <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                            <MapPin className="h-3 w-3 mr-1" />
                            GPS
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Route info */}
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {ruta.created_at && format(new Date(ruta.created_at), "dd/MM/yyyy", { locale: es })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span>{ruta.paradas_completadas || 0}/{ruta.total_paradas} paradas</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Navigation className="h-4 w-4" />
                        <span>{ruta.distancia_total_km || 0} km</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">
                          {ruta.tipo === "mixta" ? "Mixta" : ruta.tipo === "retiro" ? "Retiros" : "Entregas"}
                        </Badge>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.open(`/print/planned-route?id=${ruta.id}`, '_blank')}
                      >
                        <Printer className="mr-1 h-4 w-4" />
                        Imprimir
                      </Button>
                      {(roles.includes("admin") || roles.includes("super_admin")) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReopeningRoute(ruta)}
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Reabrir
                        </Button>
                      )}
                      {ruta.has_gps_history && ruta.chofer_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewHistoryRoute(ruta)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                        >
                          <Route className="h-4 w-4 mr-1" />
                          Ver Recorrido
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* History Route GPS Dialog */}
      <Dialog open={showHistoryRouteDialog} onOpenChange={(open) => {
        setShowHistoryRouteDialog(open);
        if (!open) {
          driverRoute.clearRoute();
          setSelectedHistoryRoute(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Recorrido de {selectedHistoryRoute?.chofer_profile?.nombre} {selectedHistoryRoute?.chofer_profile?.apellido}
            </DialogTitle>
            <DialogDescription>
              Ruta: {selectedHistoryRoute?.numero}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Map */}
            <GoogleMapsProvider>
              {driverRoute.isLoading ? (
                <div className="flex items-center justify-center h-[400px] bg-muted rounded-lg">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span>Cargando recorrido...</span>
                  </div>
                </div>
              ) : driverRoute.polylinePath.length > 0 ? (
                <MapView
                  polylinePath={driverRoute.polylinePath}
                  useGradient={true}
                  deliveryStops={driverRoute.deliveryStops}
                  height="400px"
                  className="rounded-lg overflow-hidden"
                />
              ) : (
                <div className="flex items-center justify-center h-[400px] bg-muted rounded-lg">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <MapPin className="h-8 w-8" />
                    <span>No hay datos de recorrido disponibles</span>
                  </div>
                </div>
              )}
            </GoogleMapsProvider>

            {/* Route Stats */}
            {driverRoute.polylinePath.length > 0 && (
              <RouteStatsPanel
                stats={driverRoute.routeStats}
                driverName={`${selectedHistoryRoute?.chofer_profile?.nombre || ''} ${selectedHistoryRoute?.chofer_profile?.apellido || ''}`}
                routeNumber={selectedHistoryRoute?.numero}
                isLoading={driverRoute.isLoading}
                isSnapping={driverRoute.isSnapping}
              />
            )}

            {/* Error message */}
            {driverRoute.error && (
              <div className="text-sm text-destructive text-center">
                {driverRoute.error}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Reopen Route Dialog */}
      {reopeningRoute && (
        <ReopenRouteDialog
          route={reopeningRoute}
          onClose={() => setReopeningRoute(null)}
        />
      )}
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
      {/* Close Route AlertDialog */}
      <AlertDialog open={!!closingRoute} onOpenChange={(open) => !open && setClosingRoute(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar Ruta {closingRoute?.numero}</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que querés cerrar esta ruta? Los envíos no entregados quedarán sin asignar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClosingRoute}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isClosingRoute}
              onClick={async (e) => {
                e.preventDefault();
                if (!closingRoute) return;
                setIsClosingRoute(true);
                try {
                  const { data, error } = await supabase.rpc('close_ruta_planificada', { p_ruta_id: closingRoute.id });
                  if (error) throw error;
                  const result = data as any;
                  if (!result.success) throw new Error(result.error);
                  toast.success('Ruta cerrada correctamente');
                  queryClient.invalidateQueries({ queryKey: ['rutas-activas'] });
                  queryClient.invalidateQueries({ queryKey: ['rutas-historial'] });
                  setClosingRoute(null);
                } catch (err: any) {
                  toast.error(err.message || 'Error al cerrar la ruta');
                } finally {
                  setIsClosingRoute(false);
                }
              }}
            >
              {isClosingRoute ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Cerrar Ruta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
