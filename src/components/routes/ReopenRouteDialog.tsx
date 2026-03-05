import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw, User, MapPin, Calendar, Package } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { parseDateString } from "@/lib/dateUtils";
import { toast } from "sonner";

interface ReopenRouteDialogProps {
  route: {
    id: string;
    numero: string;
    chofer_id: string;
    fecha: string;
    total_paradas: number;
    paradas_completadas: number;
    chofer_profile?: { nombre: string; apellido: string };
    sucursal?: { nombre: string };
  };
  onClose: () => void;
}

export default function ReopenRouteDialog({ route, onClose }: ReopenRouteDialogProps) {
  const queryClient = useQueryClient();

  // Fetch count of shipments that would be reactivated
  const { data: pendingCount = 0, isLoading: loadingCount } = useQuery({
    queryKey: ["reopen-route-count", route.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ruta_paradas")
        .select("envio_id, envios!inner(estado)")
        .eq("ruta_id", route.id)
        .eq("tipo", "entrega")
        .not("envios.estado", "in", "(entregado,devuelto,cancelado)");

      if (error) throw error;
      return data?.length || 0;
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("reopen_ruta_planificada", {
        p_ruta_id: route.id,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || "Error al reabrir ruta");
      return result;
    },
    onSuccess: (data) => {
      toast.success(`Ruta ${route.numero} reabierta`, {
        description: `${data.envios_reactivados} envío(s) reactivados`,
      });
      queryClient.invalidateQueries({ queryKey: ["rutas-historial"] });
      queryClient.invalidateQueries({ queryKey: ["rutas-activas"] });
      queryClient.invalidateQueries({ queryKey: ["envios-planificador"] });
      onClose();
    },
    onError: (error: Error) => {
      toast.error("Error al reabrir ruta", { description: error.message });
    },
  });

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Reabrir Ruta {route.numero}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                ¿Estás seguro que querés reabrir esta ruta? Los envíos pendientes serán
                reasignados al chofer y volverán al estado "En Reparto".
              </p>

              <div className="rounded-lg border p-3 space-y-2 text-sm">
                {route.chofer_profile && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {route.chofer_profile.nombre} {route.chofer_profile.apellido}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{format(parseDateString(route.fecha), "dd/MM/yyyy", { locale: es })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{route.paradas_completadas || 0}/{route.total_paradas} paradas completadas</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  {loadingCount ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>
                      <Badge variant="secondary">{pendingCount}</Badge> envío(s) serán reactivados
                    </span>
                  )}
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={reopenMutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              reopenMutation.mutate();
            }}
            disabled={reopenMutation.isPending || loadingCount}
          >
            {reopenMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reabriendo...
              </>
            ) : (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reabrir Ruta
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
