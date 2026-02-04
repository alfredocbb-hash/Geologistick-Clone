import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Badge } from "@/components/ui/badge";
import { AddressAutocomplete, AddressDetails } from "@/components/maps/AddressAutocomplete";
import { toast } from "sonner";
import { Loader2, MapPin, Package, Home, CheckCircle, AlertTriangle } from "lucide-react";

interface EnvioData {
  id: string;
  tracking_number: string;
  tipo: "retiro" | "entrega";
  estado: string;
  coords?: { lat: number | null; lng: number | null };
  direccion_retiro?: string;
  ciudad_retiro?: string;
  direccion_entrega?: string;
  ciudad_entrega?: string;
  remitente?: {
    direccion?: string;
    ciudad?: string;
  };
  destinatario?: {
    direccion?: string;
    ciudad?: string;
  };
}

interface EditShipmentLocationDialogProps {
  envio: EnvioData | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditShipmentLocationDialog({
  envio,
  isOpen,
  onClose,
  onSuccess,
}: EditShipmentLocationDialogProps) {
  const queryClient = useQueryClient();

  // Get current address based on tipo
  const currentAddress = envio?.tipo === "retiro"
    ? envio?.direccion_retiro || envio?.remitente?.direccion || ""
    : envio?.direccion_entrega || envio?.destinatario?.direccion || "";

  const currentCity = envio?.tipo === "retiro"
    ? envio?.ciudad_retiro || envio?.remitente?.ciudad || ""
    : envio?.ciudad_entrega || envio?.destinatario?.ciudad || "";

  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Reset state when envio changes
  const resetState = () => {
    setAddress("");
    setCity("");
    setCoords(null);
  };

  const handleAddressSelect = (details: AddressDetails) => {
    setAddress(details.address);
    setCity(details.city);
    setCoords({ lat: details.lat, lng: details.lng });
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!envio) throw new Error("No shipment selected");
      if (!address.trim()) throw new Error("Dirección requerida");

      const updateData: Record<string, any> = {};

      if (envio.tipo === "retiro") {
        updateData.direccion_retiro = address.trim();
        updateData.ciudad_retiro = city.trim() || null;
        if (coords) {
          updateData.remitente_lat = coords.lat;
          updateData.remitente_lng = coords.lng;
        }
      } else {
        updateData.direccion_entrega = address.trim();
        updateData.ciudad_entrega = city.trim() || null;
        if (coords) {
          updateData.destinatario_lat = coords.lat;
          updateData.destinatario_lng = coords.lng;
        }
      }

      const { error } = await supabase
        .from("envios")
        .update(updateData)
        .eq("id", envio.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ubicación actualizada correctamente");
      queryClient.invalidateQueries({ queryKey: ["envios-planificador"] });
      resetState();
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar la ubicación");
    },
  });

  const handleSave = () => {
    if (!address.trim()) {
      toast.error("Ingrese una dirección");
      return;
    }

    if (!coords) {
      // Warn but allow saving without coords
      toast.warning("Se guardará sin coordenadas. Considere usar el autocompletado para obtener geolocalización automática.");
    }

    updateMutation.mutate();
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!envio) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Editar Ubicación
          </DialogTitle>
          <DialogDescription>
            Corrija la dirección y geolocalización del envío
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tracking and type info */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm">{envio.tracking_number}</span>
            <Badge variant={envio.tipo === "retiro" ? "secondary" : "default"}>
              {envio.tipo === "retiro" ? (
                <><Home className="mr-1 h-3 w-3" />Retiro</>
              ) : (
                <><Package className="mr-1 h-3 w-3" />Entrega</>
              )}
            </Badge>
          </div>

          {/* Current address */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Dirección actual</p>
            <p className="text-sm">{currentAddress || "Sin dirección"}</p>
            {currentCity && (
              <p className="text-xs text-muted-foreground">{currentCity}</p>
            )}
          </div>

          {/* New address input with autocomplete */}
          <AddressAutocomplete
            value={address}
            onChange={setAddress}
            onSelect={handleAddressSelect}
            label="Nueva dirección"
            placeholder="Buscar dirección..."
            required
          />

          {/* City input */}
          <div className="space-y-2">
            <Label htmlFor="city">Ciudad</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ciudad (se completa automáticamente)"
            />
          </div>

          {/* Coordinates indicator */}
          <div className={`p-3 rounded-lg border ${
            coords 
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" 
              : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
          }`}>
            <div className="flex items-center gap-2">
              {coords ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    Coordenadas capturadas
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Sin coordenadas
                  </span>
                </>
              )}
            </div>
            {coords && (
              <p className="text-xs text-muted-foreground mt-1">
                {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
              </p>
            )}
            {!coords && (
              <p className="text-xs text-muted-foreground mt-1">
                Seleccione del autocompletado para capturar coordenadas
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={updateMutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
            ) : (
              "Guardar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditShipmentLocationDialog;
