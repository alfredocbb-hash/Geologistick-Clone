import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Loader2, 
  AlertTriangle,
  Calendar,
  Package,
  User,
  Route as RouteIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface RouteData {
  id: string;
  numero: string;
  estado: string;
  chofer_id: string | null;
  total_paradas: number;
  fecha: string;
  chofer_profile?: {
    nombre: string;
    apellido?: string;
  } | null;
}

interface CancelRouteDialogProps {
  route: RouteData;
  onClose: () => void;
}

export default function CancelRouteDialog({ route, onClose }: CancelRouteDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [action, setAction] = useState<'release' | 'reschedule'>('release');
  const [rescheduleDate, setRescheduleDate] = useState(
    format(addDays(new Date(), 1), 'yyyy-MM-dd')
  );
  const [reason, setReason] = useState('');

  const cancelMutation = useMutation({
    mutationFn: async () => {
      // 1. Get all shipments from the route
      const { data: paradas, error: paradasError } = await supabase
        .from('ruta_paradas')
        .select('envio_id')
        .eq('ruta_id', route.id);

      if (paradasError) throw paradasError;
      
      const envioIds = paradas?.map(p => p.envio_id) || [];
      
      if (envioIds.length > 0) {
        // 2. Update shipments - always set to pendiente (reprogramado is tracked via ultima_reprogramacion)
        const updateData: any = {
          chofer_id: null,
          estado: action === 'release' ? 'en_sucursal' : 'pendiente',
        };
        
        if (action === 'reschedule') {
          updateData.ultima_reprogramacion = new Date().toISOString();
          updateData.reprogramado_count = 1; // Will be incremented via SQL if needed
        }

        const { error: updateError } = await supabase
          .from('envios')
          .update(updateData)
          .in('id', envioIds);

        if (updateError) throw updateError;

        // 3. Create history entries for each shipment
        const historyEntries = envioIds.map(envioId => ({
          envio_id: envioId,
          estado_anterior: 'en_reparto' as const,
          estado_nuevo: (action === 'release' ? 'en_sucursal' : 'pendiente') as any,
          notas: `Ruta ${route.numero} cancelada. ${reason || 'Sin motivo especificado'}${
            action === 'reschedule' ? `. Reprogramado para ${format(new Date(rescheduleDate), 'dd/MM/yyyy', { locale: es })}` : ''
          }`,
          created_by: user?.id,
        }));

        const { error: historyError } = await supabase
          .from('envio_historial')
          .insert(historyEntries);

        if (historyError) throw historyError;

        // 4. Delete route stops
        const { error: deleteError } = await supabase
          .from('ruta_paradas')
          .delete()
          .eq('ruta_id', route.id);

        if (deleteError) throw deleteError;
      }

      // 5. Mark route as cancelled
      const { error: routeError } = await supabase
        .from('rutas_planificadas')
        .update({
          estado: 'cancelada',
          updated_at: new Date().toISOString(),
        })
        .eq('id', route.id);

      if (routeError) throw routeError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas-activas'] });
      queryClient.invalidateQueries({ queryKey: ['envios-planificador'] });
      toast.success(
        action === 'reschedule'
          ? `Ruta cancelada. ${route.total_paradas} envío(s) reprogramados para ${format(new Date(rescheduleDate), 'dd/MM/yyyy', { locale: es })}`
          : `Ruta cancelada. ${route.total_paradas} envío(s) liberados para replanificar`
      );
      onClose();
    },
    onError: (error: Error) => {
      toast.error('Error al cancelar ruta: ' + error.message);
    },
  });

  const choferName = route.chofer_profile 
    ? `${route.chofer_profile.nombre} ${route.chofer_profile.apellido || ''}`.trim()
    : 'Sin asignar';

  return (
    <AlertDialog open onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Cancelar Ruta {route.numero}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción liberará los envíos asignados a esta ruta.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Route Summary */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Chofer:</span>
              <span>{choferName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Envíos:</span>
              <span>{route.total_paradas} parada(s)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Fecha:</span>
              <span>{format(new Date(route.fecha), 'dd/MM/yyyy', { locale: es })}</span>
            </div>
          </div>

          {/* Action Selection */}
          <div className="space-y-3">
            <Label>¿Qué deseas hacer con los envíos?</Label>
            <RadioGroup value={action} onValueChange={(v) => setAction(v as 'release' | 'reschedule')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="release" id="release" />
                <Label htmlFor="release" className="cursor-pointer font-normal">
                  Liberar para replanificar hoy
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="reschedule" id="reschedule" />
                <Label htmlFor="reschedule" className="cursor-pointer font-normal">
                  Reprogramar todos para otra fecha
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Date picker for reschedule */}
          {action === 'reschedule' && (
            <div className="space-y-2">
              <Label htmlFor="reschedule-date">Nueva fecha de entrega</Label>
              <Input
                id="reschedule-date"
                type="date"
                value={rescheduleDate}
                min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Textarea
              id="reason"
              placeholder="Ej: Cliente solicitó reprogramación, problema con el vehículo..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>

          {/* Warning for active route */}
          {route.estado === 'en_progreso' && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-destructive">
                <strong>Atención:</strong> Esta ruta está en progreso. El chofer perderá acceso 
                inmediatamente y las paradas pendientes serán liberadas.
              </p>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={cancelMutation.isPending}
          >
            Mantener Ruta
          </Button>
          <Button
            variant="destructive"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelando...</>
            ) : (
              <><RouteIcon className="mr-2 h-4 w-4" />Confirmar Cancelación</>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
