import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  Plus, 
  FileText, 
  Printer, 
  Truck, 
  Package,
  Building2,
  ArrowRight,
  Clock,
  CheckCircle,
  Search,
  QrCode,
  MapPin,
  CalendarIcon,
  X,
  Loader2,
  Route
} from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useDriverRoute } from "@/hooks/useDriverRoute";
import { GoogleMapsProvider } from "@/components/maps/GoogleMapsProvider";
import { MapView } from "@/components/maps/MapView";
import { RouteStatsPanel } from "@/components/maps/RouteStatsPanel";

const ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800" },
  en_transito: { label: "En Tránsito", color: "bg-blue-100 text-blue-800" },
  recibida: { label: "Recibida", color: "bg-green-100 text-green-800" },
  cancelada: { label: "Cancelada", color: "bg-red-100 text-red-800" },
};

interface HojaRutaWithDetails {
  id: string;
  numero: string;
  estado: string | null;
  cantidad_envios: number | null;
  created_at: string | null;
  chofer_id: string | null;
  sucursal_origen: { id: string; nombre: string; ciudad: string | null } | null;
  sucursal_destino: { id: string; nombre: string; ciudad: string | null } | null;
  chofer?: { nombre: string | null; apellido: string | null } | null;
  has_gps_history?: boolean;
}

export default function RouteSheets() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDestino, setSelectedDestino] = useState<string>("");
  const [selectedEnvios, setSelectedEnvios] = useState<string[]>([]);
  const [selectedChofer, setSelectedChofer] = useState<string>("");
  const [selectedVehiculo, setSelectedVehiculo] = useState<string>("");
  const [notas, setNotas] = useState("");
  
  // Date filters
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  
  // Route dialog state
  const [showRouteDialog, setShowRouteDialog] = useState(false);
  const [selectedHojaRuta, setSelectedHojaRuta] = useState<HojaRutaWithDetails | null>(null);
  
  // Use driver route hook for GPS visualization
  const driverRoute = useDriverRoute();

  // Fetch hojas de ruta with date filter
  const { data: hojasRuta = [], isLoading } = useQuery({
    queryKey: ["hojas-ruta", dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("hojas_ruta")
        .select(`
          *,
          sucursal_origen:sucursales!hojas_ruta_sucursal_origen_id_fkey(id, nombre, ciudad),
          sucursal_destino:sucursales!hojas_ruta_sucursal_destino_id_fkey(id, nombre, ciudad)
        `)
        .order("created_at", { ascending: false });
      
      // Apply date filters
      if (dateFrom) {
        query = query.gte("created_at", startOfDay(dateFrom).toISOString());
      }
      if (dateTo) {
        query = query.lte("created_at", endOfDay(dateTo).toISOString());
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Get chofer profiles for each hoja that has a chofer_id
      const choferIds = [...new Set(data?.filter(hr => hr.chofer_id).map(hr => hr.chofer_id) || [])];
      let choferProfiles: Record<string, { nombre: string | null; apellido: string | null }> = {};
      
      if (choferIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, nombre, apellido")
          .in("user_id", choferIds);
        
        if (profiles) {
          choferProfiles = profiles.reduce((acc, p) => {
            acc[p.user_id] = { nombre: p.nombre, apellido: p.apellido };
            return acc;
          }, {} as Record<string, { nombre: string | null; apellido: string | null }>);
        }
      }
      
      // Check which hojas have GPS history
      const hojaIds = data?.map(hr => hr.id) || [];
      let gpsHistoryMap: Record<string, boolean> = {};
      
      if (hojaIds.length > 0) {
        const { data: gpsData } = await supabase
          .from("driver_location_history")
          .select("hoja_ruta_id")
          .in("hoja_ruta_id", hojaIds);
        
        if (gpsData) {
          const hojaIdsWithHistory = new Set(gpsData.map(g => g.hoja_ruta_id));
          gpsHistoryMap = hojaIds.reduce((acc, id) => {
            acc[id] = hojaIdsWithHistory.has(id);
            return acc;
          }, {} as Record<string, boolean>);
        }
      }
      
      // Combine data
      return data?.map(hr => ({
        ...hr,
        chofer: hr.chofer_id ? choferProfiles[hr.chofer_id] : null,
        has_gps_history: gpsHistoryMap[hr.id] || false,
      })) as HojaRutaWithDetails[];
    },
  });

  // Fetch sucursales
  const { data: sucursales = [] } = useQuery({
    queryKey: ["sucursales-activas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sucursales")
        .select("*")
        .eq("activa", true)
        .order("nombre");
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch choferes
  const { data: choferes = [] } = useQuery({
    queryKey: ["choferes-activos", profile?.tenant_id],
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
    queryKey: ["vehiculos-disponibles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehiculos")
        .select("*")
        .in("estado", ["disponible", "en_ruta"]);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch envíos pendientes para la sucursal origen
  const { data: enviosPendientes = [] } = useQuery({
    queryKey: ["envios-pendientes-hr", profile?.sucursal_id, selectedDestino],
    queryFn: async () => {
      if (!profile?.sucursal_id || !selectedDestino) return [];

      const { data, error } = await supabase
        .from("envios")
        .select(`
          *,
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido)
        `)
        .eq("sucursal_origen_id", profile.sucursal_id)
        .eq("sucursal_destino_id", selectedDestino)
        .in("estado", ["pendiente", "recogido", "en_sucursal"])
        .is("chofer_id", null);
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.sucursal_id && !!selectedDestino,
  });

  // Crear hoja de ruta
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.sucursal_id || !selectedDestino || selectedEnvios.length === 0) {
        throw new Error("Faltan datos requeridos");
      }

      // Generar número de hoja de ruta
      const { data: numeroData, error: numeroError } = await supabase
        .rpc("generate_hoja_ruta_number");
      
      if (numeroError) throw numeroError;

      // Crear hoja de ruta
      const { data: hojaRuta, error: hrError } = await supabase
        .from("hojas_ruta")
        .insert({
          numero: numeroData,
          sucursal_origen_id: profile.sucursal_id,
          sucursal_destino_id: selectedDestino,
          chofer_id: selectedChofer || null,
          vehiculo_id: selectedVehiculo || null,
          cantidad_envios: selectedEnvios.length,
          notas: notas || null,
          created_by: profile.user_id,
          tenant_id: profile.tenant_id,
        })
        .select()
        .single();

      if (hrError) throw hrError;

      // Crear relaciones con envíos
      const enviosData = selectedEnvios.map((envioId, index) => ({
        hoja_ruta_id: hojaRuta.id,
        envio_id: envioId,
        orden: index + 1,
      }));

      const { error: enviosError } = await supabase
        .from("hoja_ruta_envios")
        .insert(enviosData);

      if (enviosError) throw enviosError;

      // Actualizar estado de envíos
      const { error: updateError } = await supabase
        .from("envios")
        .update({ estado: "en_transito" })
        .in("id", selectedEnvios);

      if (updateError) throw updateError;

      return hojaRuta;
    },
    onSuccess: (hojaRuta) => {
      queryClient.invalidateQueries({ queryKey: ["hojas-ruta"] });
      queryClient.invalidateQueries({ queryKey: ["envios-pendientes-hr"] });
      toast.success(`Hoja de ruta ${hojaRuta.numero} creada exitosamente`);
      setIsCreateOpen(false);
      resetForm();
      // Abrir página de impresión
      navigate(`/print-route-sheet?id=${hojaRuta.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al crear hoja de ruta");
    },
  });

  const resetForm = () => {
    setSelectedDestino("");
    setSelectedEnvios([]);
    setSelectedChofer("");
    setSelectedVehiculo("");
    setNotas("");
  };

  const toggleEnvioSelection = (envioId: string) => {
    setSelectedEnvios(prev =>
      prev.includes(envioId)
        ? prev.filter(id => id !== envioId)
        : [...prev, envioId]
    );
  };

  const selectAllEnvios = () => {
    setSelectedEnvios(enviosPendientes.map(e => e.id));
  };

  const deselectAllEnvios = () => {
    setSelectedEnvios([]);
  };

  const filteredHojas = hojasRuta.filter(hr => 
    hr.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hr.sucursal_origen?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hr.sucursal_destino?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (hr.chofer?.nombre && hr.chofer.nombre.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (hr.chofer?.apellido && hr.chofer.apellido.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Handle opening route dialog
  const handleViewRoute = async (hr: HojaRutaWithDetails) => {
    if (!hr.chofer_id) {
      toast.error("Esta hoja de ruta no tiene chofer asignado");
      return;
    }
    
    setSelectedHojaRuta(hr);
    setShowRouteDialog(true);
    
    // Load the route data
    await driverRoute.loadRouteByHojaRuta(hr.chofer_id, hr.id);
  };

  // Clear date filters
  const clearDateFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Hojas de Ruta</h1>
          <p className="text-muted-foreground">
            Gestiona los despachos entre sucursales
          </p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Hoja de Ruta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Hoja de Ruta</DialogTitle>
              <DialogDescription>
                Selecciona el destino y los envíos a incluir en esta hoja de ruta
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Sucursal Destino */}
              <div className="space-y-2">
                <Label>Sucursal Destino *</Label>
                <Select value={selectedDestino} onValueChange={setSelectedDestino}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sucursal destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {sucursales
                      .filter(s => s.id !== profile?.sucursal_id)
                      .map(sucursal => (
                        <SelectItem key={sucursal.id} value={sucursal.id}>
                          {sucursal.nombre} - {sucursal.ciudad}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Envíos Pendientes */}
              {selectedDestino && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Envíos Disponibles ({enviosPendientes.length})</Label>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={selectAllEnvios}>
                        Seleccionar todos
                      </Button>
                      <Button variant="outline" size="sm" onClick={deselectAllEnvios}>
                        Deseleccionar
                      </Button>
                    </div>
                  </div>

                  {enviosPendientes.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No hay envíos pendientes para esta sucursal destino
                    </p>
                  ) : (
                    <div className="border rounded-lg max-h-60 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Tracking</TableHead>
                            <TableHead>Destinatario</TableHead>
                            <TableHead>Bultos</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {enviosPendientes.map(envio => (
                            <TableRow key={envio.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedEnvios.includes(envio.id)}
                                  onCheckedChange={() => toggleEnvioSelection(envio.id)}
                                />
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {envio.tracking_number}
                              </TableCell>
                              <TableCell>
                                {envio.destinatario?.nombre} {envio.destinatario?.apellido}
                              </TableCell>
                              <TableCell>{envio.cantidad_bultos || 1}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {selectedEnvios.length > 0 && (
                    <p className="text-sm text-primary">
                      {selectedEnvios.length} envío(s) seleccionado(s)
                    </p>
                  )}
                </div>
              )}

              {/* Chofer y Vehículo (Opcionales) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Chofer (Opcional)</Label>
                  <Select
                    value={selectedChofer || "none"}
                    onValueChange={(v) => setSelectedChofer(v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {choferes.map(chofer => (
                        <SelectItem key={chofer.user_id} value={chofer.user_id}>
                          {chofer.nombre} {chofer.apellido}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Vehículo (Opcional)</Label>
                  <Select
                    value={selectedVehiculo || "none"}
                    onValueChange={(v) => setSelectedVehiculo(v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {vehiculos.map(vehiculo => (
                        <SelectItem key={vehiculo.id} value={vehiculo.id}>
                          {vehiculo.patente} - {vehiculo.marca} {vehiculo.modelo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notas */}
              <div className="space-y-2">
                <Label>Notas (Opcional)</Label>
                <Textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Observaciones adicionales..."
                  rows={3}
                />
              </div>

              {/* Botón Crear */}
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={selectedEnvios.length === 0 || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  "Creando..."
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Crear Hoja de Ruta ({selectedEnvios.length} envíos)
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Búsqueda y Filtros de Fecha */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, sucursal o chofer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
                !dateFrom && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: es }) : "Desde"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={setDateFrom}
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
                !dateTo && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: es }) : "Hasta"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={setDateTo}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        
        {/* Clear Filters */}
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="icon" onClick={clearDateFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Lista de Hojas de Ruta */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-20 bg-muted" />
              <CardContent className="h-32 bg-muted/50" />
            </Card>
          ))}
        </div>
      ) : filteredHojas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No hay hojas de ruta</h3>
            <p className="text-sm text-muted-foreground">
              Crea una nueva hoja de ruta para despachar envíos entre sucursales
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredHojas.map(hr => (
            <Card key={hr.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-mono">{hr.numero}</CardTitle>
                  <Badge className={ESTADO_CONFIG[hr.estado || "pendiente"]?.color}>
                    {ESTADO_CONFIG[hr.estado || "pendiente"]?.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Origen -> Destino */}
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{hr.sucursal_origen?.nombre}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span>{hr.sucursal_destino?.nombre}</span>
                </div>

                {/* Chofer info */}
                {hr.chofer && (
                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {hr.chofer.nombre} {hr.chofer.apellido}
                    </span>
                    {hr.has_gps_history && (
                      <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                        <MapPin className="h-3 w-3 mr-1" />
                        GPS
                      </Badge>
                    )}
                  </div>
                )}

                {/* Info adicional */}
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Package className="h-4 w-4" />
                    <span>{hr.cantidad_envios} envíos</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>
                      {hr.created_at && format(new Date(hr.created_at), "dd/MM HH:mm", { locale: es })}
                    </span>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => navigate(`/print-route-sheet?id=${hr.id}`)}
                  >
                    <Printer className="mr-1 h-4 w-4" />
                    Imprimir
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/print-route-sheet?id=${hr.id}`)}
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                  {hr.has_gps_history && hr.chofer_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewRoute(hr)}
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                    >
                      <Route className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Route Dialog */}
      <Dialog open={showRouteDialog} onOpenChange={(open) => {
        setShowRouteDialog(open);
        if (!open) {
          driverRoute.clearRoute();
          setSelectedHojaRuta(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Recorrido de {selectedHojaRuta?.chofer?.nombre} {selectedHojaRuta?.chofer?.apellido}
            </DialogTitle>
            <DialogDescription>
              Hoja de Ruta: {selectedHojaRuta?.numero}
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
                driverName={`${selectedHojaRuta?.chofer?.nombre || ''} ${selectedHojaRuta?.chofer?.apellido || ''}`}
                routeNumber={selectedHojaRuta?.numero}
                isLoading={driverRoute.isLoading}
                isSnapping={driverRoute.isSnapping}
              />
            )}

            {/* Error message */}
            {driverRoute.error && (
              <div className="text-sm text-red-500 text-center">
                {driverRoute.error}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
