import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Package, Truck, RefreshCw, AlertCircle, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import MapView from "@/components/maps/MapView";
import { Link } from "react-router-dom";

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

export default function LiveMap() {
  const { data: sucursalesData = [], isLoading, refetch } = useQuery({
    queryKey: ["sucursales-live-map"],
    queryFn: async () => {
      // Fetch sucursales activas
      const { data: sucursales, error: sucError } = await supabase
        .from("sucursales")
        .select("id, nombre, direccion, ciudad, lat, lng, es_centro_logistico")
        .eq("activa", true);

      if (sucError) throw sucError;

      // Fetch envíos counts per sucursal
      const { data: envios, error: envError } = await supabase
        .from("envios")
        .select("sucursal_origen_id, sucursal_destino_id, estado")
        .in("estado", ["pendiente", "recogido", "en_bodega", "en_reparto"]);

      if (envError) throw envError;

      // Combine data
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
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Filter sucursales with coordinates
  const sucursalesConCoords = useMemo(() => {
    return sucursalesData.filter(s => s.lat && s.lng);
  }, [sucursalesData]);

  // Check if there are any geolocated branches
  const hasGeolocatedBranches = sucursalesConCoords.length > 0;
  const branchesWithoutCoords = sucursalesData.filter(s => !s.lat || !s.lng).length;

  // Map markers
  const mapMarkers = useMemo(() => {
    return sucursalesConCoords.map(s => ({
      position: { lat: Number(s.lat), lng: Number(s.lng) },
      title: s.nombre,
    }));
  }, [sucursalesConCoords]);

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
            Sucursales y envíos en tiempo real
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Package className="h-5 w-5 text-yellow-600" />
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
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
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
              <div className="p-2 bg-green-100 rounded-lg">
                <Truck className="h-5 w-5 text-green-600" />
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
              <div className="p-2 bg-purple-100 rounded-lg">
                <Building2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{sucursalesData.length}</p>
                <p className="text-xs text-muted-foreground">Sucursales ({centrosLogisticos} centros)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Mapa */}
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
                    <Link to="/branches">
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

        {/* Lista de sucursales */}
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
    </div>
  );
}
