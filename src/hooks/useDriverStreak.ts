import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export function useDriverStreak() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['driver-streak', user?.id],
    queryFn: async () => {
      if (!user?.id) return { streak: 0, totalDays: 0, achievements: [] };

      // Get all checkin dates ordered desc
      const { data: checkins, error } = await supabase
        .from('driver_checkins')
        .select('fecha')
        .eq('chofer_id', user.id)
        .order('fecha', { ascending: false })
        .limit(365);

      if (error || !checkins?.length) return { streak: 0, totalDays: 0, achievements: [] };

      const totalDays = checkins.length;

      // Calculate streak
      let streak = 0;
      const today = new Date();
      const todayStr = today.toLocaleDateString('en-CA');
      
      for (let i = 0; i < checkins.length; i++) {
        const expected = new Date(today);
        expected.setDate(expected.getDate() - i);
        const expectedStr = expected.toLocaleDateString('en-CA');
        if (checkins[i].fecha === expectedStr) {
          streak++;
        } else {
          break;
        }
      }

      // Get total deliveries for achievements
      const { count: totalDeliveries } = await supabase
        .from('envios')
        .select('id', { count: 'exact', head: true })
        .eq('chofer_id', user.id)
        .eq('estado', 'entregado');

      const deliveries = totalDeliveries || 0;

      // Build achievements
      const achievements: { id: string; label: string; emoji: string; unlocked: boolean }[] = [
        { id: 'first-day', label: 'Primer día', emoji: '🎉', unlocked: totalDays >= 1 },
        { id: 'streak-3', label: '3 días seguidos', emoji: '🔥', unlocked: streak >= 3 },
        { id: 'streak-7', label: 'Semana completa', emoji: '⭐', unlocked: streak >= 7 },
        { id: 'streak-30', label: 'Mes de fuego', emoji: '🏆', unlocked: streak >= 30 },
        { id: 'deliveries-50', label: '50 entregas', emoji: '📦', unlocked: deliveries >= 50 },
        { id: 'deliveries-100', label: '100 entregas', emoji: '💯', unlocked: deliveries >= 100 },
        { id: 'deliveries-500', label: '500 entregas', emoji: '🚀', unlocked: deliveries >= 500 },
        { id: 'deliveries-1000', label: 'Mil entregas', emoji: '👑', unlocked: deliveries >= 1000 },
      ];

      return { streak, totalDays, achievements, totalDeliveries: deliveries };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 10,
  });

  return { streak: data?.streak || 0, totalDays: data?.totalDays || 0, achievements: data?.achievements || [], totalDeliveries: data?.totalDeliveries || 0, isLoading };
}
