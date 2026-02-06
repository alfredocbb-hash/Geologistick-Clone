import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Banknote, AlertTriangle, Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export function MobileCODSection() {
  const { user } = useAuth();

  const { data: cobrosPendientes, isLoading } = useQuery({
    queryKey: ['mobile-cobros-pendientes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pagos')
        .select(`
          id,
          monto,
          created_at,
          envio:envios(tracking_number, nombre_destinatario, direccion_entrega)
        `)
        .eq('estado', 'cobrado_chofer' as any)
        .eq('created_by', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const totalPendiente = cobrosPendientes?.reduce((sum, c) => sum + (c.monto || 0), 0) || 0;

  if (isLoading || !cobrosPendientes?.length) return null;

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-white flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-400" />
        Cobros a Rendir
      </h2>

      {/* Total Card */}
      <Card className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Banknote className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-slate-300">Total a rendir</p>
                <p className="text-2xl font-bold text-white">
                  ${totalPendiente.toLocaleString()}
                </p>
              </div>
            </div>
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
              {cobrosPendientes.length} cobro{cobrosPendientes.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Individual items */}
      <div className="space-y-2">
        {cobrosPendientes.slice(0, 5).map((cobro) => (
          <Card key={cobro.id} className="bg-slate-800/30 border-slate-700/50">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Package className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-white text-sm">
                    {(cobro.envio as any)?.tracking_number || 'Sin tracking'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {cobro.created_at && format(new Date(cobro.created_at), 'dd/MM HH:mm')}
                  </p>
                </div>
              </div>
              <p className="text-amber-400 font-semibold">
                ${cobro.monto.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
        {cobrosPendientes.length > 5 && (
          <p className="text-center text-sm text-slate-400">
            +{cobrosPendientes.length - 5} cobro(s) más
          </p>
        )}
      </div>
    </div>
  );
}
