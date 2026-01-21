import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, MapPin, Search, Clock, CheckCircle2, Truck, AlertCircle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type ShipmentStatus = Database["public"]["Enums"]["shipment_status"];

const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  pendiente: { label: "Pendiente", color: "bg-yellow-500", icon: Clock },
  recogido: { label: "Recogido", color: "bg-blue-500", icon: Package },
  en_transito: { label: "En Tránsito", color: "bg-purple-500", icon: Truck },
  en_bodega: { label: "En Bodega", color: "bg-indigo-500", icon: MapPin },
  en_reparto: { label: "En Reparto", color: "bg-orange-500", icon: Truck },
  entregado: { label: "Entregado", color: "bg-green-500", icon: CheckCircle2 },
  devuelto: { label: "Devuelto", color: "bg-red-500", icon: AlertCircle },
  cancelado: { label: "Cancelado", color: "bg-gray-500", icon: AlertCircle },
};

const statusOrder: string[] = [
  "pendiente",
  "recogido", 
  "en_transito",
  "en_bodega",
  "en_reparto",
  "entregado",
];

const TrackingEmbed = () => {
  const [searchParams] = useSearchParams();
  const initialTracking = searchParams.get("tracking") || "";
  const tenantSlug = searchParams.get("tenant_slug");
  
  const [trackingInput, setTrackingInput] = useState(initialTracking);
  const [searchedTracking, setSearchedTracking] = useState(initialTracking);

  // Fetch branding if tenant_slug is provided
  const { data: branding } = useQuery({
    queryKey: ["embed-branding", tenantSlug],
    queryFn: async () => {
      if (!tenantSlug) return null;
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id")
        .eq("slug", tenantSlug)
        .single();
      
      if (!tenant) return null;
      
      const { data } = await supabase
        .from("tenant_branding")
        .select("*")
        .eq("tenant_id", tenant.id)
        .single();
      
      return data;
    },
    enabled: !!tenantSlug,
  });

  // Fetch shipment
  const { data: envio, isLoading, error } = useQuery({
    queryKey: ["tracking-embed", searchedTracking],
    queryFn: async () => {
      let query = supabase
        .from("envios")
        .select(`
          *,
          remitente:clientes!envios_remitente_id_fkey(nombre, ciudad),
          destinatario:clientes!envios_destinatario_id_fkey(nombre, ciudad),
          sucursal_origen:sucursales!envios_sucursal_origen_id_fkey(nombre, ciudad),
          sucursal_destino:sucursales!envios_sucursal_destino_id_fkey(nombre, ciudad)
        `)
        .eq("tracking_number", searchedTracking)
        .single();

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!searchedTracking,
  });

  // Fetch history
  const { data: historial } = useQuery({
    queryKey: ["tracking-embed-history", envio?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("envio_historial")
        .select("*")
        .eq("envio_id", envio!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!envio?.id,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchedTracking(trackingInput.trim().toUpperCase());
  };

  const getStatusIndex = (status: string) => {
    return statusOrder.indexOf(status);
  };

  const currentStatusIndex = envio?.estado ? getStatusIndex(envio.estado as string) : -1;
  const progress = envio?.estado === "entregado" ? 100 : 
                   envio?.estado === "devuelto" || envio?.estado === "cancelado" ? 0 :
                   Math.max(0, ((currentStatusIndex + 1) / statusOrder.length) * 100);

  // Apply custom branding
  const primaryColor = (branding as any)?.color_primario || "#6366f1";
  const logoUrl = (branding as any)?.logo_url;
  const appName = (branding as any)?.nombre_app || "Tracking";

  return (
    <div 
      className="min-h-screen bg-background p-4"
      style={{ 
        "--embed-primary": primaryColor,
      } as React.CSSProperties}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header with branding */}
        <div className="text-center space-y-2">
          {logoUrl && (
            <img 
              src={logoUrl} 
              alt={appName}
              className="h-12 mx-auto object-contain"
            />
          )}
          <h1 className="text-2xl font-bold" style={{ color: primaryColor }}>
            {appName}
          </h1>
          <p className="text-muted-foreground text-sm">Seguí tu envío en tiempo real</p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={trackingInput}
            onChange={(e) => setTrackingInput(e.target.value)}
            placeholder="Ingresá tu número de tracking"
            className="flex-1"
          />
          <Button type="submit" style={{ backgroundColor: primaryColor }}>
            <Search className="h-4 w-4" />
          </Button>
        </form>

        {/* Loading */}
        {isLoading && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        )}

        {/* Not found */}
        {!isLoading && searchedTracking && !envio && (
          <Card>
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">No encontramos el envío</p>
              <p className="text-sm text-muted-foreground mt-1">
                Verificá que el número de tracking sea correcto
              </p>
            </CardContent>
          </Card>
        )}

        {/* Shipment details */}
        {envio && (
          <div className="space-y-4">
            {/* Status card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Tracking</p>
                    <p className="font-mono font-bold">{envio.tracking_number}</p>
                  </div>
                  {envio.estado && statusConfig[envio.estado as string] && (
                    <Badge 
                      className={`${statusConfig[envio.estado as string].color} text-white`}
                    >
                      {statusConfig[envio.estado as ShipmentStatus].label}
                    </Badge>
                  )}
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Origen</span>
                    <span>En tránsito</span>
                    <span>Entregado</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Origin/Destination */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-blue-100">
                      <MapPin className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Origen</p>
                      <p className="font-medium text-sm">
                        {envio.ciudad_retiro || envio.sucursal_origen?.ciudad || "N/A"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-green-100">
                      <MapPin className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Destino</p>
                      <p className="font-medium text-sm">
                        {envio.ciudad_entrega || envio.sucursal_destino?.ciudad || "N/A"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* History */}
            {historial && historial.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium mb-4">Historial de movimientos</h3>
                  <div className="space-y-4">
                    {historial.slice(0, 5).map((item, index) => (
                      <div key={item.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div 
                            className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-primary' : 'bg-muted'}`}
                            style={index === 0 ? { backgroundColor: primaryColor } : {}}
                          />
                          {index < Math.min(historial.length - 1, 4) && (
                            <div className="w-px h-full bg-muted flex-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                              {statusConfig[item.estado_nuevo as string]?.label || item.estado_nuevo}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(item.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                          </p>
                          {item.notas && (
                            <p className="text-xs mt-1">{item.notas}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Powered by LogiTrack
        </p>
      </div>
    </div>
  );
};

export default TrackingEmbed;
