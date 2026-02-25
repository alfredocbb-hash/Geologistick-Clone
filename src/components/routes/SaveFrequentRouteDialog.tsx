import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Star, Loader2, Home, Package, MapPin } from "lucide-react";

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

interface SaveFrequentRouteDialogProps {
  open: boolean;
  onClose: () => void;
  stops: RouteStop[];
  envios: any[];
}

export default function SaveFrequentRouteDialog({
  open,
  onClose,
  stops,
  envios,
}: SaveFrequentRouteDialogProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!nombre.trim()) {
        throw new Error("Ingresa un nombre para la ruta frecuente");
      }

      if (!profile?.tenant_id) {
        throw new Error("No se encontró el tenant");
      }

      // Create the frequent route
      const { data: rutaFrecuente, error: rutaError } = await supabase
        .from("rutas_frecuentes")
        .insert({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          sucursal_id: profile.sucursal_id,
          tenant_id: profile.tenant_id,
          created_by: profile.user_id,
        })
        .select()
        .single();

      if (rutaError) throw rutaError;

      // Create the stops - extract client info from envios
      const paradasData = stops.map((stop, index) => {
        const envio = envios.find(e => e.id === stop.envio_id);
        const clienteId = stop.tipo === "retiro" 
          ? envio?.remitente_id 
          : envio?.destinatario_id;

        return {
          ruta_frecuente_id: rutaFrecuente.id,
          cliente_id: clienteId || null,
          orden: index + 1,
          tipo: stop.tipo,
          direccion: stop.direccion,
          ciudad: stop.tipo === "retiro" 
            ? (envio?.ciudad_retiro || envio?.remitente?.ciudad)
            : (envio?.ciudad_entrega || envio?.destinatario?.ciudad),
          lat: stop.lat,
          lng: stop.lng,
          notas: null,
        };
      });

      const { error: paradasError } = await supabase
        .from("ruta_frecuente_paradas")
        .insert(paradasData);

      if (paradasError) throw paradasError;

      return rutaFrecuente;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rutas-frecuentes"] });
      toast.success(`Ruta "${data.nombre}" guardada como frecuente`);
      setNombre("");
      setDescripcion("");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al guardar la ruta frecuente");
    },
  });

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Guardar como Ruta Frecuente
          </DialogTitle>
          <DialogDescription>
            Guarda esta ruta como plantilla para usarla rápidamente en el futuro
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre de la ruta *</Label>
            <Input
              id="nombre"
              placeholder="Ej: Ruta Norte, Clientes Mayoristas..."
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción (opcional)</Label>
            <Textarea
              id="descripcion"
              placeholder="Descripción de la ruta..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Paradas a guardar ({stops.length})
            </Label>
            <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-2">
              {stops.map((stop, index) => (
                <div 
                  key={stop.envio_id}
                  className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {index + 1}
                  </div>
                  <Badge variant={stop.tipo === "retiro" ? "secondary" : "default"} className="text-xs">
                    {stop.tipo === "retiro" ? (
                      <><Home className="mr-1 h-3 w-3" />Retiro</>
                    ) : (
                      <><Package className="mr-1 h-3 w-3" />Entrega</>
                    )}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{stop.cliente_nombre}</p>
                    <p className="text-xs text-muted-foreground truncate">{stop.direccion}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !nombre.trim()}
          >
            {saveMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
            ) : (
              <><Star className="mr-2 h-4 w-4" />Guardar Ruta</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
