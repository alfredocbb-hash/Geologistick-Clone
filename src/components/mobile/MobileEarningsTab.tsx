import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Wallet, TrendingUp, Calendar, ChevronRight, DollarSign, Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

export function MobileEarningsTab() {
  const { user } = useAuth();

  // Fetch commissions
  const { data: comisiones, isLoading: loadingComisiones } = useQuery({
    queryKey: ['mobile-comisiones', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comisiones')
        .select(`
          *,
          envio:envios(tracking_number, precio_total, fecha_entrega)
        `)
        .eq('chofer_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Fetch settlements
  const { data: liquidaciones, isLoading: loadingLiquidaciones } = useQuery({
    queryKey: ['mobile-liquidaciones', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('liquidaciones')
        .select('*')
        .eq('chofer_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Calculate stats
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const todayEarnings = comisiones?.filter(c => {
    const date = new Date(c.created_at || '');
    return date.toDateString() === today.toDateString();
  }).reduce((sum, c) => sum + (c.monto || 0), 0) || 0;

  const weekEarnings = comisiones?.filter(c => {
    const date = new Date(c.created_at || '');
    return date >= weekStart && date <= weekEnd;
  }).reduce((sum, c) => sum + (c.monto || 0), 0) || 0;

  const monthEarnings = comisiones?.filter(c => {
    const date = new Date(c.created_at || '');
    return date >= monthStart && date <= monthEnd;
  }).reduce((sum, c) => sum + (c.monto || 0), 0) || 0;

  const pendingSettlement = comisiones?.filter(c => !c.liquidacion_id)
    .reduce((sum, c) => sum + (c.monto || 0), 0) || 0;

  const isLoading = loadingComisiones || loadingLiquidaciones;

  const getSettlementStatusBadge = (estado: string | null) => {
    switch (estado) {
      case 'pendiente':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendiente</Badge>;
      case 'aprobada':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Aprobada</Badge>;
      case 'pagada':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Pagada</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Mis Ganancias</h1>

      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <span className="text-slate-300">Pendiente de cobro</span>
            </div>
          </div>
          <p className="text-4xl font-bold text-white">
            ${pendingSettlement.toLocaleString()}
          </p>
          <p className="text-sm text-slate-400 mt-2">
            {comisiones?.filter(c => !c.liquidacion_id).length || 0} entregas sin liquidar
          </p>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-slate-400 mb-1">Hoy</p>
            <p className="text-lg font-bold text-white">
              ${todayEarnings.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-slate-400 mb-1">Semana</p>
            <p className="text-lg font-bold text-white">
              ${weekEarnings.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-slate-400 mb-1">Mes</p>
            <p className="text-lg font-bold text-white">
              ${monthEarnings.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Settlements */}
      {liquidaciones && liquidaciones.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-slate-400" />
            Liquidaciones
          </h2>

          <div className="space-y-2">
            {liquidaciones.slice(0, 5).map((liq) => (
              <Card key={liq.id} className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-white">
                        ${liq.monto_total.toLocaleString()}
                      </p>
                      {getSettlementStatusBadge(liq.estado)}
                    </div>
                    <p className="text-sm text-slate-400">
                      {format(new Date(liq.periodo_inicio), 'dd/MM')} - {format(new Date(liq.periodo_fin), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-500" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent Commissions */}
      {comisiones && comisiones.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-slate-400" />
            Comisiones Recientes
          </h2>

          <div className="space-y-2">
            {comisiones.slice(0, 5).map((com) => (
              <Card key={com.id} className="bg-slate-800/30 border-slate-700/50">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Package className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white text-sm">
                        {com.envio?.tracking_number}
                      </p>
                      <p className="text-xs text-slate-400">
                        {com.created_at && format(new Date(com.created_at), 'dd/MM HH:mm')}
                      </p>
                    </div>
                  </div>
                  <p className="text-green-400 font-semibold">
                    +${com.monto.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
