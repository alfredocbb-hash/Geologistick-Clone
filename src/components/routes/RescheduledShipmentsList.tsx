import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CalendarClock, 
  Package, 
  Home, 
  MapPin, 
  RefreshCw,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDateString } from '@/lib/dateUtils';

interface RescheduledShipmentsListProps {
  selectedEnvios: string[];
  onToggleEnvio: (envioId: string) => void;
  onSelectAll: (envioIds: string[]) => void;
}

export default function RescheduledShipmentsList({ 
  selectedEnvios, 
  onToggleEnvio,
  onSelectAll 
}: RescheduledShipmentsListProps) {
  const { profile, roles } = useAuth();

  // Fetch rescheduled shipments
  const { data: enviosReprogramados = [], isLoading } = useQuery({
    queryKey: ['envios-reprogramados', profile?.sucursal_id],
    queryFn: async () => {
      const query = supabase
        .from('envios')
        .select(`
          *,
          remitente:clientes!envios_remitente_id_fkey(nombre, apellido, direccion, ciudad, telefono),
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, direccion, ciudad, telefono)
        `)
        .gt('reprogramado_count', 0)
        .in('estado', ['pendiente', 'recogido', 'en_bodega'])
        .is('chofer_id', null)
        .order('ultima_reprogramacion', { ascending: false });

      // Filter by branch if not admin
      if (!roles.includes('admin') && !roles.includes('supervisor') && profile?.sucursal_id) {
        query.or(`sucursal_origen_id.eq.${profile.sucursal_id},sucursal_destino_id.eq.${profile.sucursal_id}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Calculate if envio is for pickup or delivery
  const enrichedEnvios = useMemo(() => {
    return enviosReprogramados.map(envio => ({
      ...envio,
      tipo: envio.requiere_retiro && envio.estado === 'pendiente' ? 'retiro' : 'entrega',
      coords: envio.requiere_retiro && envio.estado === 'pendiente'
        ? { lat: envio.remitente_lat, lng: envio.remitente_lng }
        : { lat: envio.destinatario_lat, lng: envio.destinatario_lng },
    }));
  }, [enviosReprogramados]);

  const handleSelectAll = () => {
    const allIds = enrichedEnvios.map(e => e.id);
    onSelectAll(allIds);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (enrichedEnvios.length === 0) {
    return (
      <div className="text-center py-12">
        <CalendarClock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-medium mb-2">Sin envíos reprogramados</h3>
        <p className="text-sm text-muted-foreground">
          Los envíos que se reprogramen aparecerán aquí para re-asignación
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <RefreshCw className="h-3 w-3" />
            {enrichedEnvios.length} reprogramado(s)
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={handleSelectAll}>
          Seleccionar todos
        </Button>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-3">
          {enrichedEnvios.map((envio) => {
            const isSelected = selectedEnvios.includes(envio.id);
            
            return (
              <div 
                key={envio.id}
                className={`p-4 rounded-lg border transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-primary/10 border-primary' 
                    : 'bg-muted/50 hover:bg-muted'
                }`}
                onClick={() => onToggleEnvio(envio.id)}
              >
                <div className="flex items-start gap-3">
                  <Checkbox 
                    checked={isSelected} 
                    className="mt-1"
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={() => onToggleEnvio(envio.id)}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-mono text-sm font-medium">
                        {envio.tracking_number}
                      </span>
                      <Badge variant={envio.tipo === 'retiro' ? 'secondary' : 'default'} className="text-xs">
                        {envio.tipo === 'retiro' ? (
                          <><Home className="mr-1 h-3 w-3" />Retiro</>
                        ) : (
                          <><Package className="mr-1 h-3 w-3" />Entrega</>
                        )}
                      </Badge>
                      <Badge variant="destructive" className="text-xs gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {envio.reprogramado_count}x reprogramado
                      </Badge>
                    </div>

                    <div className="grid gap-1 text-sm">
                      <p className="font-medium">
                        {envio.tipo === 'retiro' 
                          ? `${envio.remitente?.nombre} ${envio.remitente?.apellido || ''}`
                          : `${envio.destinatario?.nombre} ${envio.destinatario?.apellido || ''}`
                        }
                      </p>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {envio.tipo === 'retiro' 
                          ? envio.remitente?.direccion 
                          : envio.destinatario?.direccion
                        }
                      </p>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {envio.fecha_entrega && (
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          Nueva fecha: {format(parseDateString(envio.fecha_entrega), 'dd/MM/yyyy', { locale: es })}
                        </span>
                      )}
                      {envio.ultima_reprogramacion && (
                        <span>
                          Última reprog: {format(parseDateString(envio.ultima_reprogramacion), 'dd/MM HH:mm', { locale: es })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {selectedEnvios.length > 0 && (
        <div className="pt-4 border-t">
          <p className="text-sm text-primary font-medium">
            {selectedEnvios.length} envío(s) seleccionado(s) para re-asignar
          </p>
        </div>
      )}
    </div>
  );
}
