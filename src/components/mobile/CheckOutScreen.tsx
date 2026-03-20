import { useState, useEffect } from 'react';
import { LogOut, Package, TrendingUp, MapPin, Clock, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { getTodayString } from '@/lib/dateUtils';
import { useQuery } from '@tanstack/react-query';

interface CheckOutScreenProps {
  onClose: () => void;
  onCheckOutComplete: () => void;
}

function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = value / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.round(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{display.toLocaleString()}</>;
}

export function CheckOutScreen({ onClose, onCheckOutComplete }: CheckOutScreenProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const { data: daySummary } = useQuery({
    queryKey: ['checkout-day-summary', user?.id],
    queryFn: async () => {
      const today = getTodayString();
      const { data: deliveries } = await supabase
        .from('envios')
        .select('id, precio_total, estado, distancia_km')
        .eq('chofer_id', user?.id)
        .gte('updated_at', today)
        .lt('updated_at', today + 'T23:59:59');

      const completed = deliveries?.filter(d => d.estado === 'entregado').length || 0;
      const failed = deliveries?.filter(d => ['devuelto', 'incidencia', 'ausente'].includes(d.estado || '')).length || 0;
      const total = deliveries?.length || 0;
      const earnings = deliveries?.filter(d => d.estado === 'entregado').reduce((s, d) => s + (d.precio_total || 0), 0) || 0;
      const km = deliveries?.reduce((s, d) => s + (d.distancia_km || 0), 0) || 0;

      // Get checkin time
      const { data: checkin } = await supabase
        .from('driver_checkins')
        .select('checked_in_at')
        .eq('chofer_id', user?.id)
        .eq('fecha', today)
        .limit(1)
        .single();

      const checkinTime = checkin?.checked_in_at ? new Date(checkin.checked_in_at) : null;
      const hoursWorked = checkinTime ? Math.round((Date.now() - checkinTime.getTime()) / 3600000 * 10) / 10 : 0;

      return { completed, failed, total, earnings, km: Math.round(km), hoursWorked };
    },
    enabled: !!user?.id,
  });

  const handleCheckOut = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const today = new Date().toLocaleDateString('en-CA');
      const { error } = await supabase
        .from('driver_checkins')
        .update({ checkout_at: new Date().toISOString() })
        .eq('chofer_id', user.id)
        .eq('fecha', today);

      if (error) throw error;
      setDone(true);
      toast.success('¡Jornada finalizada!');
      setTimeout(() => onCheckOutComplete(), 2000);
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast.error('Error al finalizar jornada');
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { icon: Package, label: 'Entregas', value: daySummary?.completed || 0, color: 'text-emerald-400', bg: 'from-emerald-500/20 to-emerald-500/10' },
    { icon: TrendingUp, label: 'Ganancia', value: daySummary?.earnings || 0, prefix: '$', color: 'text-blue-400', bg: 'from-blue-500/20 to-blue-500/10' },
    { icon: MapPin, label: 'Km recorridos', value: daySummary?.km || 0, color: 'text-purple-400', bg: 'from-purple-500/20 to-purple-500/10' },
    { icon: Clock, label: 'Horas', value: daySummary?.hoursWorked || 0, color: 'text-amber-400', bg: 'from-amber-500/20 to-amber-500/10' },
  ];

  if (done) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center px-6">
        <div className="animate-scale-in">
          <CheckCircle2 className="h-20 w-20 text-emerald-400 mx-auto mb-4" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2 animate-fade-in">¡Buen trabajo!</h1>
        <p className="text-slate-400 text-center animate-fade-in">Tu jornada ha sido registrada. Descansá bien 💪</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto">
      <div className="min-h-full flex flex-col px-6 py-10" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2.5rem)' }}>
        <div className="flex-1 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-1">Resumen del Día</h1>
            <p className="text-slate-400 text-sm">Tu rendimiento de hoy</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            {stats.map((stat) => (
              <Card key={stat.label} className="bg-slate-900/60 border-slate-800/50 overflow-hidden">
                <CardContent className="p-4 relative">
                  <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${stat.bg} rounded-full blur-2xl`} />
                  <div className="relative">
                    <stat.icon className={`h-6 w-6 ${stat.color} mb-2`} />
                    <p className="text-2xl font-bold text-white">
                      {stat.prefix || ''}<AnimatedNumber value={stat.value} />
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Success rate */}
          {daySummary && daySummary.total > 0 && (
            <Card className="bg-slate-900/60 border-slate-800/50">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-400">Tasa de éxito</span>
                  <span className="text-sm font-bold text-white">
                    {Math.round((daySummary.completed / daySummary.total) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000"
                    style={{ width: `${(daySummary.completed / daySummary.total) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-500">
                  <span>{daySummary.completed} entregados</span>
                  {daySummary.failed > 0 && <span>{daySummary.failed} fallidos</span>}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3 mt-8" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
          <Button
            onClick={handleCheckOut}
            disabled={loading}
            size="lg"
            className="w-full h-14 text-lg font-semibold rounded-2xl gap-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600"
          >
            {loading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Finalizando...</>
            ) : (
              <><LogOut className="h-5 w-5" /> Finalizar Jornada</>
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full text-slate-400 hover:text-white"
          >
            Seguir trabajando
          </Button>
        </div>
      </div>
    </div>
  );
}
