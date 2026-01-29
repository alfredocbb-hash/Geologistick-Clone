import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { 
  Star, 
  Loader2, 
  MapPin, 
  PlayCircle, 
  Trash2, 
  Home, 
  Package,
  Building2,
  Clock,
  Edit,
} from "lucide-react";

interface FrequentRoutesTabProps {
  onUseRoute: (envioIds: string[], rutaNombre: string) => void;
  enviosPendientes: any[];
}

export default function FrequentRoutesTab({ 
  onUseRoute,
  enviosPendientes,
}: FrequentRoutesTabProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch frequent routes
  const { data: rutasFrecuentes = [], isLoading } = useQuery({
    queryKey: ["rutas-frecuentes", profile?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rutas_frecuentes")
        .select(`
          *,
          paradas:ruta_frecuente_paradas(
            *,
            cliente:clientes(id, nombre, apellido, direccion, ciudad, telefono, lat, lng)
          ),
          sucursal:sucursales(nombre)
        `)
        .eq("activa", true)
        .order("nombre");

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.tenant_id,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("rutas_frecuentes")
        .update({ activa: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rutas-frecuentes"] });
      toast.success("Ruta frecuente eliminada");
      setDeleteId(null);
    },
    onError: () => {
      toast.error("Error al eliminar la ruta");
    },
  });

  // Handle using a frequent route
  const handleUseRoute = (ruta: any) => {
    // Get client IDs from the route stops
    const clienteIds = ruta.paradas
      .map((p: any) => p.cliente_id)
      .filter(Boolean);

    // Find pending shipments for these clients
    const enviosMatchingClients = enviosPendientes.filter(envio => {
      const remitenteMatch = clienteIds.includes(envio.remitente_id);
      const destinatarioMatch = clienteIds.includes(envio.destinatario_id);
      return remitenteMatch || destinatarioMatch;
    });

    if (enviosMatchingClients.length > 0) {
      onUseRoute(
        enviosMatchingClients.map(e => e.id),
        ruta.nombre
      );
      toast.success(`Se pre-seleccionaron ${enviosMatchingClients.length} envíos de la ruta "${ruta.nombre}"`);
    } else {
      // Allow navigation even without matching shipments
      onUseRoute([], ruta.nombre);
      toast.info(
        `Ruta "${ruta.nombre}" seleccionada. No hay envíos pendientes para los clientes de esta ruta, pero puedes crear envíos manualmente.`
      );
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (rutasFrecuentes.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Star className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">No hay rutas frecuentes guardadas</h3>
          <p className="text-sm text-muted-foreground">
            Crea una ruta y guárdala como "Frecuente" para accederla rápidamente
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Rutas Frecuentes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rutasFrecuentes.map((ruta: any) => {
            // Count matching pending shipments
            const clienteIds = ruta.paradas
              .map((p: any) => p.cliente_id)
              .filter(Boolean);
            const matchingCount = enviosPendientes.filter(e => 
              clienteIds.includes(e.remitente_id) || clienteIds.includes(e.destinatario_id)
            ).length;

            return (
              <div 
                key={ruta.id}
                className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{ruta.nombre}</h3>
                      {matchingCount > 0 && (
                        <Badge variant="default" className="text-xs">
                          {matchingCount} envíos disponibles
                        </Badge>
                      )}
                    </div>
                    
                    {ruta.descripcion && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {ruta.descripcion}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {ruta.paradas?.length || 0} paradas
                      </span>
                      {ruta.sucursal && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {ruta.sucursal.nombre}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(ruta.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Show stops preview */}
                    {ruta.paradas && ruta.paradas.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {ruta.paradas.slice(0, 5).map((parada: any, idx: number) => (
                          <Badge 
                            key={parada.id} 
                            variant="outline" 
                            className="text-xs font-normal"
                          >
                            {parada.tipo === "retiro" ? (
                              <Home className="mr-1 h-3 w-3" />
                            ) : (
                              <Package className="mr-1 h-3 w-3" />
                            )}
                            {parada.cliente 
                              ? `${parada.cliente.nombre}` 
                              : `Parada ${idx + 1}`}
                          </Badge>
                        ))}
                        {ruta.paradas.length > 5 && (
                          <Badge variant="outline" className="text-xs font-normal">
                            +{ruta.paradas.length - 5} más
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant={matchingCount > 0 ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleUseRoute(ruta)}
                      title={matchingCount === 0 ? "No hay envíos pendientes, pero puedes usar esta ruta como referencia" : `${matchingCount} envíos disponibles para esta ruta`}
                    >
                      <PlayCircle className="mr-1 h-4 w-4" />
                      Usar Ruta
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(ruta.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ruta frecuente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La ruta frecuente será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
