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
import { Package, Truck, Building2, ArrowRight, Loader2, CheckCircle, QrCode } from "lucide-react";
import QRScanner from "@/components/qr/QRScanner";

interface EnvioItem {
  id: string;
  envio: {
    id: string;
    tracking_number: string;
    cantidad_bultos: number;
    estado: string;
    destinatario: { nombre: string; apellido: string | null };
    remitente: { nombre: string; apellido: string | null };
  };
  estado: string;
}

interface CollectRouteSheetDialogProps {
  hojaRutaId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CollectRouteSheetDialog({ hojaRutaId, onClose, onSuccess }: CollectRouteSheetDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEnvios, setSelectedEnvios] = useState<string[]>([]);
  const [showScanner, setShowScanner] = useState(false);

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

      const { data: enviosData, error: enviosError } = await supabase
        .from("hoja_ruta_envios")
        .select(`
          id,
          estado,
          envio:envios(
            id,
            tracking_number,
            cantidad_bultos,
            estado,
            destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido),
            remitente:clientes!envios_remitente_id_fkey(nombre, apellido)
          )
        `)
        .eq("hoja_ruta_id", hojaRutaId);

      if (enviosError) throw enviosError;

      return {
        ...data,
        envios: (enviosData || []) as unknown as EnvioItem[],
      };
    },
    enabled: !!hojaRutaId,
  });

  const collectMutation = useMutation({
    mutationFn: async () => {
      if (!hojaRuta || selectedEnvios.length === 0) {
        throw new Error("Selecciona al menos un envío");
      }

      const { error: hreError } = await supabase
        .from("hoja_ruta_envios")
        .update({ estado: "recolectado" })
        .eq("hoja_ruta_id", hojaRuta.id)
        .in("envio_id", selectedEnvios);

      if (hreError) throw hreError;

      const { error: enviosError } = await supabase
        .from("envios")
        .update({ 
          estado: "en_transito",
          chofer_id: user?.id,
        })
        .in("id", selectedEnvios);

      if (enviosError) throw enviosError;

      const allCollected = hojaRuta.envios.every(e =>
        selectedEnvios.includes(e.envio?.id) || e.estado === "recolectado"
      );

      if (allCollected) {
        await supabase
          .from("hojas_ruta")
          .update({
            estado: "en_transito",
            inicio_real: new Date().toISOString(),
            fecha_salida: new Date().toISOString(),
          })
          .eq("id", hojaRuta.id);
      }

      return { count: selectedEnvios.length, allCollected };
    },
    onSuccess: ({ count, allCollected }) => {
      queryClient.invalidateQueries({ queryKey: ["my-hojas-ruta"] });
      toast.success(allCollected ? "¡Ruta iniciada!" : `${count} envíos recolectados`);
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleScannerCollect = (scannedData: string[]) => {
    if (!hojaRuta) return;

    // Mapear los trackings escaneados a IDs de envíos de esta hoja de ruta
    const foundIds = hojaRuta.envios
      .filter(item => scannedData.includes(item.envio.tracking_number))
      .map(item => item.envio.id);

    if (foundIds.length > 0) {
      setSelectedEnvios(prev => Array.from(new Set([...prev, ...foundIds])));
      toast.success(`${foundIds.length} paquetes marcados para colectar`);
    } else {
      toast.error("No se encontraron paquetes de esta hoja de ruta");
    }
    setShowScanner(false);
  };

  if (!hojaRutaId) return null;

  const pendingEnvios = hojaRuta?.envios.filter(e => e.estado !== "recolectado") || [];

  return (
    <>
      <Dialog open={!!hojaRutaId && !showScanner} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-warning" />
                Recolectar Envíos
              </div>
              <Button
                variant="outline"
                size="sm"
                className="bg-warning/10 border-warning/30 text-warning font-bold"
                onClick={() => setShowScanner(true)}
              >
                <QrCode className="h-4 w-4 mr-2" />
                ESCANEAR CARGA
              </Button>
            </DialogTitle>
            <DialogDescription>
              Escanea los paquetes o selecciónalos manualmente para cargarlos
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : hojaRuta ? (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-xl p-4 border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-lg">{hojaRuta.numero}</span>
                  <Badge className="bg-warning text-black">{pendingEnvios.length} pendientes</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>{hojaRuta.sucursal_origen?.nombre}</span>
                  <ArrowRight className="h-4 w-4" />
                  <span>{hojaRuta.sucursal_destino?.nombre}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Paquete / Tracking</TableHead>
                        <TableHead className="text-right">Bultos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingEnvios.map(item => (
                        <TableRow key={item.id} className={selectedEnvios.includes(item.envio.id) ? "bg-warning/5" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={selectedEnvios.includes(item.envio.id)}
                              onCheckedChange={() => {
                                setSelectedEnvios(prev =>
                                  prev.includes(item.envio.id) ? prev.filter(id => id !== item.envio.id) : [...prev, item.envio.id]
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-mono font-bold text-sm">{item.envio.tracking_number}</div>
                            <div className="text-[10px] text-muted-foreground uppercase">
                              {item.envio.remitente?.nombre} {item.envio.remitente?.apellido}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {item.envio.cantidad_bultos}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <Button
                className="w-full h-14 bg-warning hover:bg-warning/90 text-black font-black rounded-2xl shadow-lg"
                onClick={() => collectMutation.mutate()}
                disabled={selectedEnvios.length === 0 || collectMutation.isPending}
              >
                {collectMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Truck className="mr-2 h-5 w-5" />}
                CONFIRMAR RECOLECCIÓN ({selectedEnvios.length})
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {showScanner && (
        <QRScanner
          onScan={(scannedData: string) => {
            if (!hojaRuta) return;
            const foundItem = hojaRuta.envios.find(item => item.envio.tracking_number === scannedData);
            if (foundItem) {
              setSelectedEnvios(prev => {
                if (prev.includes(foundItem.envio.id)) return prev;
                toast.success(`Paquete ${scannedData} marcado`);
                return [...prev, foundItem.envio.id];
              });
            } else {
              toast.error(`${scannedData} no pertenece a esta hoja`);
            }
          }}
          onClose={() => setShowScanner(false)}
          continuousMode
          scannedCount={selectedEnvios.length}
        />
      )}
    </>
  );
}
