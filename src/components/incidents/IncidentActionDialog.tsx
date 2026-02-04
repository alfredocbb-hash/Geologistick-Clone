import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Loader2, 
  AlertTriangle, 
  RefreshCw, 
  Calendar as CalendarIcon, 
  RotateCcw, 
  MapPin,
  Undo2,
  XCircle,
  UserX,
  PackageX,
  MapPinOff,
  HelpCircle,
  CheckCircle,
  Clock,
  Image
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import EditAddressDialog from './EditAddressDialog';

const RESOLUTION_ACTIONS = [
  { 
    value: 're_intento', 
    label: 'Re-intentar hoy',
    description: 'Liberar para asignar a otra ruta inmediatamente',
    icon: RefreshCw,
  },
  { 
    value: 'reprogramar', 
    label: 'Reprogramar',
    description: 'Programar nuevo intento para otra fecha',
    icon: CalendarIcon,
  },
  { 
    value: 'corregir_direccion', 
    label: 'Corregir dirección',
    description: 'Actualizar dirección antes de re-asignar',
    icon: MapPin,
  },
  { 
    value: 'devolver', 
    label: 'Devolver al remitente',
    description: 'Marcar para devolución',
    icon: Undo2,
  },
  { 
    value: 'cancelar', 
    label: 'Cancelar envío',
    description: 'Cancelar el envío definitivamente',
    icon: XCircle,
  },
];

const INCIDENT_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  ausente: { label: 'Cliente Ausente', icon: UserX, color: 'text-amber-500' },
  rechazo: { label: 'Rechazó Paquete', icon: XCircle, color: 'text-red-500' },
  direccion_incorrecta: { label: 'Dirección Incorrecta', icon: MapPinOff, color: 'text-orange-500' },
  paquete_dañado: { label: 'Paquete Dañado', icon: PackageX, color: 'text-destructive' },
  otro: { label: 'Otro', icon: HelpCircle, color: 'text-muted-foreground' },
};

interface Incident {
  id: string;
  tipo: string;
  descripcion: string | null;
  foto_evidencia: string | null;
  estado: string;
  accion_tomada: string | null;
  resolucion: string | null;
  resuelto_at: string | null;
  created_at: string;
  envio: {
    id: string;
    tracking_number: string;
    estado: string;
    reprogramado_count: number | null;
    nombre_destinatario: string | null;
    direccion_entrega: string | null;
    ciudad_entrega: string | null;
    whatsapp_destinatario: string | null;
  };
  chofer: {
    nombre: string | null;
    apellido: string | null;
  } | null;
  resuelto_por_profile: {
    nombre: string | null;
    apellido: string | null;
  } | null;
}

interface IncidentActionDialogProps {
  incident: Incident;
  onClose: () => void;
  onSuccess: () => void;
  readOnly?: boolean;
}

export default function IncidentActionDialog({ 
  incident, 
  onClose, 
  onSuccess, 
  readOnly = false 
}: IncidentActionDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [showEditAddress, setShowEditAddress] = useState(false);

  const typeInfo = INCIDENT_TYPE_CONFIG[incident.tipo] || INCIDENT_TYPE_CONFIG.otro;
  const TypeIcon = typeInfo.icon;

  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedAction) throw new Error('Datos incompletos');

      // Update incident
      const { error: incidentError } = await supabase
        .from('incidentes')
        .update({
          estado: 'resuelto',
          accion_tomada: selectedAction,
          resolucion: notes || null,
          resuelto_por: user.id,
          resuelto_at: new Date().toISOString(),
        })
        .eq('id', incident.id);

      if (incidentError) throw incidentError;

      // Update shipment based on action
      const envioId = incident.envio.id;
      const currentReprogramadoCount = incident.envio.reprogramado_count || 0;

      switch (selectedAction) {
        case 're_intento':
          await supabase
            .from('envios')
            .update({ 
              estado: 'pendiente', 
              chofer_id: null,
              chofer_ultima_milla_id: null,
            })
            .eq('id', envioId);
          
          // Add history entry
          await supabase
            .from('envio_historial')
            .insert({
              envio_id: envioId,
              estado_anterior: 'incidencia',
              estado_nuevo: 'pendiente',
              notas: `Re-intento desde incidencia: ${incident.tipo}. ${notes || ''}`.trim(),
              created_by: user.id,
            });
          break;

        case 'reprogramar':
          if (!newDate) throw new Error('Selecciona una fecha');
          
          await supabase
            .from('envios')
            .update({ 
              estado: 'pendiente', 
              chofer_id: null,
              chofer_ultima_milla_id: null,
              fecha_entrega: format(newDate, 'yyyy-MM-dd'),
              reprogramado_count: currentReprogramadoCount + 1,
              ultima_reprogramacion: new Date().toISOString(),
            })
            .eq('id', envioId);

          await supabase
            .from('envio_historial')
            .insert({
              envio_id: envioId,
              estado_anterior: 'incidencia',
              estado_nuevo: 'pendiente',
              notas: `Reprogramado para ${format(newDate, 'dd/MM/yyyy')}. Incidencia: ${incident.tipo}. ${notes || ''}`.trim(),
              created_by: user.id,
            });
          break;

        case 'corregir_direccion':
          // This will be handled by the EditAddressDialog
          // Just close and open address editor
          break;

        case 'devolver':
          await supabase
            .from('envios')
            .update({ estado: 'devuelto' })
            .eq('id', envioId);

          await supabase
            .from('envio_historial')
            .insert({
              envio_id: envioId,
              estado_anterior: 'incidencia',
              estado_nuevo: 'devuelto',
              notas: `Devuelto por incidencia: ${incident.tipo}. ${notes || ''}`.trim(),
              created_by: user.id,
            });
          break;

        case 'cancelar':
          await supabase
            .from('envios')
            .update({ estado: 'cancelado' })
            .eq('id', envioId);

          await supabase
            .from('envio_historial')
            .insert({
              envio_id: envioId,
              estado_anterior: 'incidencia',
              estado_nuevo: 'cancelado',
              notas: `Cancelado por incidencia: ${incident.tipo}. ${notes || ''}`.trim(),
              created_by: user.id,
            });
          break;
      }
    },
    onSuccess: () => {
      toast.success('Incidencia resuelta correctamente');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['envios'] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error('Error al resolver incidencia: ' + error.message);
    },
  });

  const handleSubmit = () => {
    if (selectedAction === 'corregir_direccion') {
      setShowEditAddress(true);
    } else {
      resolveMutation.mutate();
    }
  };

  const handleAddressUpdated = async () => {
    // After address is updated, resolve the incident
    if (!user?.id) return;

    await supabase
      .from('incidentes')
      .update({
        estado: 'resuelto',
        accion_tomada: 'corregir_direccion',
        resolucion: notes || 'Dirección corregida',
        resuelto_por: user.id,
        resuelto_at: new Date().toISOString(),
      })
      .eq('id', incident.id);

    await supabase
      .from('envios')
      .update({ 
        estado: 'pendiente', 
        chofer_id: null,
        chofer_ultima_milla_id: null,
      })
      .eq('id', incident.envio.id);

    await supabase
      .from('envio_historial')
      .insert({
        envio_id: incident.envio.id,
        estado_anterior: 'incidencia',
        estado_nuevo: 'pendiente',
        notas: `Dirección corregida. ${notes || ''}`.trim(),
        created_by: user.id,
      });

    toast.success('Dirección actualizada e incidencia resuelta');
    queryClient.invalidateQueries({ queryKey: ['incidents'] });
    queryClient.invalidateQueries({ queryKey: ['envios'] });
    setShowEditAddress(false);
    onSuccess();
  };

  if (showEditAddress) {
    return (
      <EditAddressDialog
        envioId={incident.envio.id}
        currentAddress={incident.envio.direccion_entrega || ''}
        currentCity={incident.envio.ciudad_entrega || ''}
        onClose={() => setShowEditAddress(false)}
        onSuccess={handleAddressUpdated}
      />
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {readOnly ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                Incidencia Resuelta
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-warning" />
                Resolver Incidencia
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {readOnly 
              ? 'Detalles de la incidencia resuelta'
              : 'Selecciona la acción a tomar para este envío'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Shipment Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="font-mono text-base px-3 py-1">
                {incident.envio.tracking_number}
              </Badge>
              <div className="flex items-center gap-2">
                <TypeIcon className={cn('h-5 w-5', typeInfo.color)} />
                <span className="text-sm font-medium">{typeInfo.label}</span>
              </div>
            </div>
            <div className="text-sm space-y-1">
              <p><strong>Destinatario:</strong> {incident.envio.nombre_destinatario || '-'}</p>
              <p><strong>Dirección:</strong> {incident.envio.direccion_entrega}, {incident.envio.ciudad_entrega}</p>
              <p><strong>Intentos previos:</strong> {incident.envio.reprogramado_count || 0}</p>
            </div>
            {incident.descripcion && (
              <div className="pt-2 border-t">
                <p className="text-sm"><strong>Descripción del chofer:</strong></p>
                <p className="text-sm text-muted-foreground">{incident.descripcion}</p>
              </div>
            )}
            {incident.foto_evidencia && (
              <div className="pt-2">
                <a 
                  href={incident.foto_evidencia} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Image className="h-4 w-4" />
                  Ver foto de evidencia
                </a>
              </div>
            )}
          </div>

          {/* Resolution Info (Read-only) */}
          {readOnly && incident.accion_tomada && (
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Resuelto</span>
              </div>
              <div className="text-sm space-y-1">
                <p><strong>Acción:</strong> {
                  RESOLUTION_ACTIONS.find(a => a.value === incident.accion_tomada)?.label || incident.accion_tomada
                }</p>
                {incident.resolucion && (
                  <p><strong>Notas:</strong> {incident.resolucion}</p>
                )}
                {incident.resuelto_at && (
                  <p><strong>Fecha:</strong> {format(new Date(incident.resuelto_at), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                )}
                {incident.resuelto_por_profile && (
                  <p><strong>Por:</strong> {incident.resuelto_por_profile.nombre} {incident.resuelto_por_profile.apellido}</p>
                )}
              </div>
            </div>
          )}

          {/* Action Selection (Edit mode) */}
          {!readOnly && (
            <>
              <div className="space-y-3">
                <Label>Acción a tomar *</Label>
                <RadioGroup value={selectedAction} onValueChange={setSelectedAction}>
                  {RESOLUTION_ACTIONS.map((action) => {
                    const ActionIcon = action.icon;
                    const isDestructive = action.value === 'devolver' || action.value === 'cancelar';
                    
                    return (
                      <div 
                        key={action.value}
                        className={cn(
                          'flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors',
                          selectedAction === action.value 
                            ? isDestructive 
                              ? 'border-destructive bg-destructive/5' 
                              : 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/50'
                        )}
                        onClick={() => setSelectedAction(action.value)}
                      >
                        <RadioGroupItem value={action.value} id={action.value} className="mt-1" />
                        <ActionIcon className={cn(
                          'h-5 w-5 mt-0.5',
                          isDestructive ? 'text-destructive' : 'text-muted-foreground'
                        )} />
                        <div className="flex-1">
                          <Label 
                            htmlFor={action.value} 
                            className={cn(
                              'cursor-pointer font-medium',
                              isDestructive && 'text-destructive'
                            )}
                          >
                            {action.label}
                          </Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {action.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </RadioGroup>
              </div>

              {/* Date Picker for Reprogramar */}
              {selectedAction === 'reprogramar' && (
                <div className="space-y-2">
                  <Label>Nueva fecha de entrega *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !newDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newDate ? format(newDate, 'PPP', { locale: es }) : 'Seleccionar fecha'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newDate}
                        onSelect={setNewDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Agregar notas sobre la resolución..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            {readOnly ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!readOnly && (
            <Button 
              onClick={handleSubmit}
              disabled={resolveMutation.isPending || !selectedAction || (selectedAction === 'reprogramar' && !newDate)}
              variant={selectedAction === 'devolver' || selectedAction === 'cancelar' ? 'destructive' : 'default'}
              className="gap-2"
            >
              {resolveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Confirmar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
