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
import { Package, CheckCircle, Building2, ArrowRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ReceiveRouteSheetDialogProps {
  hojaRutaId: string | null;
  onClose: () => void;
}

export function ReceiveRouteSheetDialog({ hojaRutaId, onClose }: ReceiveRouteSheetDialogProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEnvios, setSelectedEnvios] = useState<string[]>([]);

  const { data: hojaRuta, isLoading } = useQuery({
    queryKey: ["hoja-ruta-recepcion", hojaRutaId],
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
            nombre_destinatario,
            destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido)
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

  const receiveMutation = useMutation({
    mutationFn: async () => {
      if (!hojaRuta || selectedEnvios.length === 0) {
        throw new Error("Selecciona al menos un envío");
      }

      // Update hoja_ruta_envios
      const { error: hreError } = await supabase
        .from("hoja_ruta_envios")
        .update({
          estado: "recibido",
          recibido_at: new Date().toISOString(),
        })
        .eq("hoja_ruta_id", hojaRuta.id)
        .in("envio_id", selectedEnvios);

      if (hreError) throw hreError;

      // Update envíos status and track physical location
      const updateData: Record<string, any> = { estado: "en_sucursal", chofer_id: null };
      if (profile?.sucursal_id) {
        updateData.sucursal_entrega_id = profile.sucursal_id;
      }
      const { data: updatedRows, error: enviosError } = await supabase
        .from("envios")
        .update(updateData)
        .in("id", selectedEnvios)
        .select("id");

      if (enviosError) throw enviosError;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error("No se pudieron actualizar los envíos. Verificá permisos de sucursal.");
      }

      // Check if all envíos received
      const allReceived = hojaRuta.envios.every(e => 
        selectedEnvios.includes(e.envio?.id) || e.estado === "recibido"
      );

      if (allReceived) {
        // Update hoja de ruta
        const { error: hrError } = await supabase
          .from("hojas_ruta")
          .update({
            estado: "recibida",
            fecha_llegada_real: new Date().toISOString(),
            recibido_por: profile?.user_id,
          })
          .eq("id", hojaRuta.id);

        if (hrError) throw hrError;
      }

      return { count: selectedEnvios.length, allReceived };
    },
    onSuccess: ({ count, allReceived }) => {
      queryClient.invalidateQueries({ queryKey: ["hoja-ruta-recepcion"] });
      queryClient.invalidateQueries({ queryKey: ["hojas-ruta"] });
      queryClient.invalidateQueries({ queryKey: ["envios"] });
      
      toast.success(
        allReceived
          ? `Hoja de ruta recibida completamente (${count} envíos)`
          : `${count} envío(s) recibido(s)`
      );
      
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al recibir envíos");
    },
  });

  const getEnvioId = (item: any) => item.envio?.id || item.envio_id;

  const toggleEnvio = (envioId: string) => {
    setSelectedEnvios(prev =>
      prev.includes(envioId)
        ? prev.filter(id => id !== envioId)
        : [...prev, envioId]
    );
  };

  const selectAllPending = () => {
    const pendingIds = hojaRuta?.envios
      .filter(e => e.estado !== "recibido" && getEnvioId(e))
      .map(e => getEnvioId(e)) || [];
    setSelectedEnvios(pendingIds);
  };

  if (!hojaRutaId) return null;

  const pendingEnvios = hojaRuta?.envios.filter(e => e.estado !== "recibido") || [];
  const receivedEnvios = hojaRuta?.envios.filter(e => e.estado === "recibido") || [];

  return (
    <Dialog open={!!hojaRutaId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Recibir Hoja de Ruta
          </DialogTitle>
          <DialogDescription>
            Confirma la recepción de los envíos de esta hoja de ruta
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
                <Badge variant={hojaRuta.estado === "recibida" ? "default" : "secondary"}>
                  {hojaRuta.estado === "recibida" ? "Recibida" : "En Tránsito"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{hojaRuta.sucursal_origen?.nombre}</span>
                <ArrowRight className="h-4 w-4" />
                <span>{hojaRuta.sucursal_destino?.nombre}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Creada: {format(new Date(hojaRuta.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
              </p>
            </div>

            {/* Envíos pendientes */}
            {pendingEnvios.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Envíos Pendientes ({pendingEnvios.length})</h4>
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
                        <TableHead>Destinatario</TableHead>
                        <TableHead className="text-center">Bultos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingEnvios.map(item => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedEnvios.includes(getEnvioId(item))}
                              onCheckedChange={() => {
                                const id = getEnvioId(item);
                                if (id) toggleEnvio(id);
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {item.envio?.tracking_number || '—'}
                          </TableCell>
                          <TableCell>
                            {item.envio?.nombre_destinatario || `${item.envio?.destinatario?.nombre || ''} ${item.envio?.destinatario?.apellido || ''}`.trim() || 'Sin destinatario'}
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

            {/* Envíos ya recibidos */}
            {receivedEnvios.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-muted-foreground">
                  Ya Recibidos ({receivedEnvios.length})
                </h4>
                <div className="border rounded-lg opacity-60">
                  <Table>
                    <TableBody>
                      {receivedEnvios.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="w-10">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {item.envio?.tracking_number}
                          </TableCell>
                          <TableCell>
                            {item.envio?.nombre_destinatario || `${item.envio?.destinatario?.nombre || ''} ${item.envio?.destinatario?.apellido || ''}`.trim() || 'Sin destinatario'}
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
                className="w-full"
                size="lg"
                onClick={() => receiveMutation.mutate()}
                disabled={selectedEnvios.length === 0 || receiveMutation.isPending}
              >
                {receiveMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</>
                ) : (
                  <><CheckCircle className="mr-2 h-4 w-4" />Confirmar Recepción ({selectedEnvios.length})</>
                )}
              </Button>
            )}

            {pendingEnvios.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                Todos los envíos de esta hoja de ruta ya fueron recibidos
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
