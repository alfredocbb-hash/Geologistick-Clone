import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Phone, Mail, Package, Truck, Navigation, Loader2 } from "lucide-react";

interface SucursalData {
  id: string;
  nombre: string;
  direccion: string;
  ciudad?: string | null;
  telefono?: string | null;
  email?: string | null;
  lat?: number | null;
  lng?: number | null;
  es_centro_logistico?: boolean | null;
  enviosCount?: number;
}

interface BranchMapPopupProps {
  sucursal: SucursalData | null;
  isOpen: boolean;
  onClose: () => void;
  onCreatePickupRoute?: (sucursalId: string) => void;
  onGeolocate?: (sucursal: SucursalData) => Promise<void>;
  isGeolocating?: boolean;
}

export function BranchMapPopup({
  sucursal,
  isOpen,
  onClose,
  onCreatePickupRoute,
  onGeolocate,
  isGeolocating = false,
}: BranchMapPopupProps) {
  if (!sucursal) return null;

  const hasCoords = sucursal.lat && sucursal.lng;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {sucursal.nombre}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Badges */}
          <div className="flex items-center gap-2">
            {sucursal.es_centro_logistico && (
              <Badge variant="default">Centro Logístico</Badge>
            )}
            {sucursal.enviosCount !== undefined && sucursal.enviosCount > 0 && (
              <Badge variant="secondary">
                <Package className="mr-1 h-3 w-3" />
                {sucursal.enviosCount} envío(s)
              </Badge>
            )}
          </div>

          {/* Dirección */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              Dirección
            </p>
            <p className="font-medium">{sucursal.direccion}</p>
            {sucursal.ciudad && <p className="text-sm text-muted-foreground">{sucursal.ciudad}</p>}
          </div>

          {/* Teléfono */}
          {sucursal.telefono && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{sucursal.telefono}</span>
            </div>
          )}

          {/* Email */}
          {sucursal.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{sucursal.email}</span>
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
                {hasCoords ? "✓ Geolocalizada" : "Sin coordenadas"}
              </span>
            </div>
            {hasCoords && (
              <p className="text-xs text-muted-foreground mt-1">
                {sucursal.lat?.toFixed(6)}, {sucursal.lng?.toFixed(6)}
              </p>
            )}
          </div>

          {/* Envíos pendientes */}
          {sucursal.enviosCount !== undefined && sucursal.enviosCount > 0 && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm font-medium text-primary">
                📦 {sucursal.enviosCount} envío(s) pendientes de retiro
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Paquetes en esta sucursal listos para ser trasladados
              </p>
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-2 pt-2">
            {!hasCoords && onGeolocate && (
              <Button 
                onClick={() => onGeolocate(sucursal)} 
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
            {onCreatePickupRoute && sucursal.enviosCount && sucursal.enviosCount > 0 && (
              <Button 
                variant={!hasCoords && onGeolocate ? "outline" : "default"}
                onClick={() => onCreatePickupRoute(sucursal.id)}
                className="flex-1"
              >
                <Truck className="mr-2 h-4 w-4" />
                Crear ruta de retiro
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
