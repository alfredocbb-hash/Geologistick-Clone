import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Truck, Package, CheckCircle, AlertCircle, History, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MLShipmentHistorySectionProps {
  shipmentId: number;
  sellerId: string;
}

interface MLHistoryEvent {
  date: string;
  status: string;
  substatus: string;
  date_handling?: string;
}

const ML_STATUS_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: 'Pendiente', icon: Clock, color: 'bg-yellow-500' },
  handling: { label: 'En preparación', icon: Package, color: 'bg-orange-500' },
  ready_to_ship: { label: 'Listo para enviar', icon: Package, color: 'bg-blue-500' },
  shipped: { label: 'En camino', icon: Truck, color: 'bg-blue-600' },
  delivered: { label: 'Entregado', icon: CheckCircle, color: 'bg-green-500' },
  not_delivered: { label: 'No entregado', icon: AlertCircle, color: 'bg-red-500' },
  cancelled: { label: 'Cancelado', icon: AlertCircle, color: 'bg-gray-500' },
};

const ML_SUBSTATUS_LABELS: Record<string, string> = {
  rescheduled: 'Reprogramado',
  rescheduled_by_buyer: 'Reprogramado por comprador',
  rescheduled_by_meli: 'Reprogramado por ML',
  returning_to_hub: 'Volviendo a centro',
  second_visit: 'Segunda visita',
  ready_to_print: 'Listo para imprimir',
  printed: 'Etiqueta impresa',
  in_hub: 'En centro de distribución',
  waiting_for_withdrawal: 'Esperando retiro',
  receiver_absent: 'Destinatario ausente',
  buyer_refused: 'Rechazado por comprador',
  stolen: 'Robado',
  damaged: 'Dañado',
  lost: 'Extraviado',
};

export function MLShipmentHistorySection({ shipmentId, sellerId }: MLShipmentHistorySectionProps) {
  const [showHistory, setShowHistory] = useState(false);

  const { data: history, isLoading, error } = useQuery({
    queryKey: ['ml-shipment-history', shipmentId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadolibre-shipment-history?shipment_id=${shipmentId}&seller_id=${sellerId}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al consultar historial');
      }

      const data = await response.json();
      return (data.history || []) as MLHistoryEvent[];
    },
    enabled: showHistory,
  });

  if (!showHistory) {
    return (
      <Button variant="outline" size="sm" className="w-full" onClick={() => setShowHistory(true)}>
        <History className="mr-2 h-4 w-4" />
        Ver Historial ML
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <History className="h-4 w-4 text-blue-600" />
        Historial de Estados ML
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Error al cargar historial'}
        </p>
      ) : history && history.length > 0 ? (
        <ScrollArea className="max-h-[250px] pr-2">
          <div className="relative">
            <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-border" />
            <div className="space-y-4">
              {history.map((event, index) => {
                const config = ML_STATUS_LABELS[event.status] || ML_STATUS_LABELS.pending;
                const Icon = config.icon;
                return (
                  <div key={index} className="relative flex gap-3">
                    <div className={`z-10 ${config.color} p-1.5 rounded-full text-white`}>
                      <Icon className="h-3 w-3" />
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {config.label}
                        </Badge>
                        {event.substatus && event.substatus !== event.status && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              ['rescheduled', 'rescheduled_by_buyer', 'rescheduled_by_meli', 'receiver_absent', 'second_visit'].includes(event.substatus)
                                ? 'bg-yellow-50 border-yellow-300 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-600 dark:text-yellow-400'
                                : ''
                            }`}
                          >
                            {ML_SUBSTATUS_LABELS[event.substatus] || event.substatus}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(event.date), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-3">Sin historial disponible</p>
      )}
    </div>
  );
}
