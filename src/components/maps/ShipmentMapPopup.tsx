import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Package, Home, Phone, Eye, Navigation } from "lucide-react";

interface EnvioData {
  id: string;
  tracking_number: string;
  tipo: "retiro" | "entrega";
  estado: string;
  coords?: { lat: number | null; lng: number | null };
  remitente?: {
    nombre: string;
    apellido: string;
    direccion: string;
    ciudad: string;
    telefono: string;
  };
  destinatario?: {
    nombre: string;
    apellido: string;
    direccion: string;
    ciudad: string;
    telefono: string;
  };
  direccion_retiro?: string;
  ciudad_retiro?: string;
  direccion_entrega?: string;
  ciudad_entrega?: string;
}

interface ShipmentMapPopupProps {
  envio: EnvioData | null;
  isOpen: boolean;
  onClose: () => void;
  onGeolocate: (envio: EnvioData) => Promise<void>;
  onViewDetails?: (envioId: string) => void;
  isGeolocating: boolean;
}

export function ShipmentMapPopup({
  envio,
  isOpen,
  onClose,
  onGeolocate,
  onViewDetails,
  isGeolocating,
}: ShipmentMapPopupProps) {
  if (!envio) return null;

  const hasCoords = envio.coords?.lat && envio.coords?.lng;
  const clienteNombre = envio.tipo === "retiro"
    ? `${envio.remitente?.nombre || ''} ${envio.remitente?.apellido || ''}`.trim() || "Sin nombre"
    : `${envio.destinatario?.nombre || ''} ${envio.destinatario?.apellido || ''}`.trim() || "Sin nombre";
  
  const direccion = envio.tipo === "retiro"
    ? envio.direccion_retiro || envio.remitente?.direccion || "Sin dirección"
    : envio.direccion_entrega || envio.destinatario?.direccion || "Sin dirección";
  
  const ciudad = envio.tipo === "retiro"
    ? envio.ciudad_retiro || envio.remitente?.ciudad || ""
    : envio.ciudad_entrega || envio.destinatario?.ciudad || "";

  const telefono = envio.tipo === "retiro"
    ? envio.remitente?.telefono
    : envio.destinatario?.telefono;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {!hasCoords && (
              <span className="text-yellow-500">⚠️</span>
            )}
            <span className="font-mono">{envio.tracking_number}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo y estado */}
          <div className="flex items-center gap-2">
            <Badge variant={envio.tipo === "retiro" ? "secondary" : "default"}>
              {envio.tipo === "retiro" ? (
                <><Home className="mr-1 h-3 w-3" />Retiro</>
              ) : (
                <><Package className="mr-1 h-3 w-3" />Entrega</>
              )}
            </Badge>
            <Badge variant="outline">{envio.estado}</Badge>
          </div>

          {/* Cliente */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Cliente</p>
            <p className="font-medium">{clienteNombre}</p>
          </div>

          {/* Dirección */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Dirección</p>
            <p className="font-medium">{direccion}</p>
            {ciudad && <p className="text-sm text-muted-foreground">{ciudad}</p>}
          </div>

          {/* Teléfono */}
          {telefono && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{telefono}</span>
            </div>
          )}

          {/* Estado de coordenadas */}
          <div className={`p-3 rounded-lg border ${
            hasCoords 
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" 
              : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
          }`}>
            <div className="flex items-center gap-2">
              <MapPin className={`h-5 w-5 ${hasCoords ? "text-green-600" : "text-yellow-600"}`} />
              <span className={`text-sm font-medium ${hasCoords ? "text-green-800 dark:text-green-200" : "text-yellow-800 dark:text-yellow-200"}`}>
                {hasCoords ? "✓ Geolocalizado" : "Sin coordenadas"}
              </span>
            </div>
            {hasCoords && (
              <p className="text-xs text-muted-foreground mt-1">
                {envio.coords?.lat?.toFixed(6)}, {envio.coords?.lng?.toFixed(6)}
              </p>
            )}
          </div>

          {/* Acciones */}
          <div className="flex gap-2">
            {!hasCoords && (
              <Button 
                onClick={() => onGeolocate(envio)} 
                disabled={isGeolocating}
                className="flex-1"
              >
                {isGeolocating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Geolocalizando...</>
                ) : (
                  <><Navigation className="mr-2 h-4 w-4" />Geolocalizar</>
                )}
              </Button>
            )}
            {onViewDetails && (
              <Button 
                variant="outline" 
                onClick={() => onViewDetails(envio.id)}
                className={hasCoords ? "flex-1" : ""}
              >
                <Eye className="mr-2 h-4 w-4" />
                Ver detalles
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
