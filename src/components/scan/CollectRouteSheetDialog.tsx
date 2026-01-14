import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Package, Truck, Building2, ArrowRight, Loader2, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CollectRouteSheetDialogProps {
  hojaRutaId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CollectRouteSheetDialog({ hojaRutaId, onClose, onSuccess }: CollectRouteSheetDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEnvios, setSelectedEnvios] = useState<string[]>([]);

  const { data: hojaRuta, isLoading } = useQuery({
    queryKey: ["hoja-ruta-collect", hojaRutaId],
    queryFn: async () => {
      if (!hojaRutaId) return null;

      const { data, error } = await supabase
        .from("hojas_ruta")
        .select(`
          *,
          sucursal_origen:sucursales!hojas_ruta_sucursal_origen_id_fkey(id, nombre),
          sucursal_destino:sucursales!hojas_ruta_sucursal_destino_id_fkey(id, nombre)
        `)
        .eq("id", hojaRutaId)
        .single();

      if (error) throw error;

      // Fetch envíos
      const { data: enviosData, error: enviosError } = await supabase
        .from("hoja_ruta_envios")
        .select(`
          *,
          envio:envios(
            id,
            tracking_number,
            cantidad_bultos,
            estado,
            destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido),
            remitente:clientes!envios_remitente_id_fkey(nombre, apellido)
          )
        `)
        .eq("hoja_ruta_id", hojaRutaId)
        .order("orden");

      if (enviosError) throw enviosError;

      return {
        ...data,
        envios: enviosData || [],
      };
    },
    enabled: !!hojaRutaId,
  });

  const collectMutation = useMutation({
    mutationFn: async () => {
      if (!hojaRuta || selectedEnvios.length === 0) {
        throw new Error("Selecciona al menos un envío");
      }

      // Update hoja_ruta_envios to 'recolectado'
      const { error: hreError } = await supabase
        .from("hoja_ruta_envios")
        .update({
          estado: "recolectado",
        })
        .eq("hoja_ruta_id", hojaRuta.id)
        .in("envio_id", selectedEnvios);

      if (hreError) throw hreError;

      // Update envíos status to 'en_transito'
      const { error: enviosError } = await supabase
        .from("envios")
        .update({ 
          estado: "en_transito",
          chofer_id: user?.id,
        })
        .in("id", selectedEnvios);

      if (enviosError) throw enviosError;

      // Check if all envíos are collected
      const allCollected = hojaRuta.envios.every(e => 
        selectedEnvios.includes(e.envio?.id) || e.estado === "recolectado"
      );

      // If all collected, start the route
      if (allCollected) {
        const { error: hrError } = await supabase
          .from("hojas_ruta")
          .update({
            estado: "en_transito",
            inicio_real: new Date().toISOString(),
            fecha_salida: new Date().toISOString(),
          })
          .eq("id", hojaRuta.id);

        if (hrError) throw hrError;
      }

      return { count: selectedEnvios.length, allCollected };
    },
    onSuccess: ({ count, allCollected }) => {
      queryClient.invalidateQueries({ queryKey: ["hoja-ruta-collect"] });
      queryClient.invalidateQueries({ queryKey: ["hojas-ruta"] });
      queryClient.invalidateQueries({ queryKey: ["my-hojas-ruta"] });
      queryClient.invalidateQueries({ queryKey: ["envios"] });
      
      toast.success(
        allCollected
          ? `${count} envíos recolectados. ¡Ruta iniciada!`
          : `${count} envío(s) recolectado(s)`
      );
      
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al recolectar envíos");
    },
  });

  const toggleEnvio = (envioId: string) => {
    setSelectedEnvios(prev =>
      prev.includes(envioId)
        ? prev.filter(id => id !== envioId)
        : [...prev, envioId]
    );
  };

  const selectAllPending = () => {
    const pendingIds = hojaRuta?.envios
      .filter(e => e.estado !== "recolectado" && e.envio?.id)
      .map(e => e.envio.id) || [];
    setSelectedEnvios(pendingIds);
  };

  if (!hojaRutaId) return null;

  const pendingEnvios = hojaRuta?.envios.filter(e => e.estado !== "recolectado") || [];
  const collectedEnvios = hojaRuta?.envios.filter(e => e.estado === "recolectado") || [];

  return (
    <Dialog open={!!hojaRutaId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Recolectar Envíos
          </DialogTitle>
          <DialogDescription>
            Selecciona los envíos que estás cargando en el vehículo para iniciar la ruta
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : hojaRuta ? (
          <div className="space-y-4">
            {/* Info de la hoja */}
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono font-medium text-lg">{hojaRuta.numero}</span>
                <Badge variant="secondary">
                  {hojaRuta.estado === "en_transito" ? "En Tránsito" : "Pendiente"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{hojaRuta.sucursal_origen?.nombre}</span>
                <ArrowRight className="h-4 w-4" />
                <span>{hojaRuta.sucursal_destino?.nombre}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {hojaRuta.cantidad_envios || pendingEnvios.length + collectedEnvios.length} envíos en total
              </p>
            </div>

            {/* Envíos pendientes de recolectar */}
            {pendingEnvios.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Por Recolectar ({pendingEnvios.length})</h4>
                  <Button variant="outline" size="sm" onClick={selectAllPending}>
                    Seleccionar todos
                  </Button>
                </div>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Tracking</TableHead>
                        <TableHead>Remitente</TableHead>
                        <TableHead className="text-center">Bultos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingEnvios.map(item => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedEnvios.includes(item.envio?.id)}
                              onCheckedChange={() => item.envio?.id && toggleEnvio(item.envio.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {item.envio?.tracking_number}
                          </TableCell>
                          <TableCell>
                            {item.envio?.remitente?.nombre} {item.envio?.remitente?.apellido}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.envio?.cantidad_bultos || 1}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Envíos ya recolectados */}
            {collectedEnvios.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-muted-foreground">
                  Ya Recolectados ({collectedEnvios.length})
                </h4>
                <div className="border rounded-lg opacity-60">
                  <Table>
                    <TableBody>
                      {collectedEnvios.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="w-10">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {item.envio?.tracking_number}
                          </TableCell>
                          <TableCell>
                            {item.envio?.remitente?.nombre} {item.envio?.remitente?.apellido}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Botón confirmar */}
            {pendingEnvios.length > 0 && (
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                size="lg"
                onClick={() => collectMutation.mutate()}
                disabled={selectedEnvios.length === 0 || collectMutation.isPending}
              >
                {collectMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</>
                ) : (
                  <><Truck className="mr-2 h-4 w-4" />Recolectar y Cargar ({selectedEnvios.length})</>
                )}
              </Button>
            )}

            {pendingEnvios.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                Todos los envíos de esta hoja de ruta ya fueron recolectados
              </p>
            )}
          </div>
        ) : (
          <p className="text-center text-destructive py-4">
            No se encontró la hoja de ruta
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
