import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Package, CheckCircle, XCircle, Clock, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function MobileHistoryTab() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch recent scan history
  const { data: history, isLoading } = useQuery({
    queryKey: ['mobile-scan-history', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      
      const { data, error } = await supabase
        .from('envio_historial')
        .select(`
          id,
          estado_nuevo,
          estado_anterior,
          created_at,
          notas,
          envio:envios!envio_historial_envio_id_fkey(
            tracking_number,
            direccion_entrega,
            ciudad_entrega
          )
        `)
        .eq('created_by', profile.user_id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.user_id
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'entregado':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'no_entregado':
      case 'rechazado':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-blue-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'pendiente': 'Pendiente',
      'en_transito': 'En Tránsito',
      'en_sucursal_origen': 'En Origen',
      'en_sucursal_destino': 'En Destino',
      'en_distribucion': 'En Distribución',
      'entregado': 'Entregado',
      'no_entregado': 'No Entregado',
      'rechazado': 'Rechazado',
      'devuelto': 'Devuelto'
    };
    return labels[status] || status;
  };

  const filteredHistory = history?.filter((item: any) => 
    item.envio?.tracking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.envio?.direccion_entrega?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white mb-4">Historial de Escaneos</h2>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 bg-slate-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white mb-3">Historial de Escaneos</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Buscar por tracking o dirección..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* History list */}
      {filteredHistory && filteredHistory.length > 0 ? (
        <div className="space-y-3">
          {filteredHistory.map((item: any) => (
            <Card 
              key={item.id} 
              className="bg-slate-800/50 border-slate-700 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {getStatusIcon(item.estado_nuevo)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-3 h-3 text-slate-500" />
                    <span className="font-mono text-sm text-white">
                      {item.envio?.tracking_number || 'N/A'}
                    </span>
                  </div>
                  
                  <p className="text-sm text-slate-400 truncate mb-2">
                    {item.envio?.direccion_entrega}, {item.envio?.ciudad_entrega}
                  </p>

                  <div className="flex items-center justify-between">
                    <Badge 
                      variant="outline" 
                      className="text-xs bg-slate-700/50 border-slate-600"
                    >
                      {getStatusLabel(item.estado_nuevo)}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {format(new Date(item.created_at), "dd MMM HH:mm", { locale: es })}
                    </span>
                  </div>

                  {item.notas && (
                    <p className="text-xs text-slate-500 mt-2 italic">
                      "{item.notas}"
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-slate-800/50 border-slate-700 p-8 text-center">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">
            {searchTerm ? 'No se encontraron resultados' : 'No hay historial de escaneos'}
          </p>
        </Card>
      )}
    </div>
  );
}
