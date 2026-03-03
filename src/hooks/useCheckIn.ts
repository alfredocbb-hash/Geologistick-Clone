import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export function useCheckIn() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

  const { data: checkedIn = false, isLoading } = useQuery({
    queryKey: ['driver-checkin-today', user?.id, today],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from('driver_checkins')
        .select('id')
        .eq('chofer_id', user.id)
        .eq('fecha', today)
        .limit(1);

      if (error) {
        console.error('Error checking check-in:', error);
        return false;
      }
      return (data?.length ?? 0) > 0;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['driver-checkin-today'] });
  };

  return { checkedIn, isLoading, invalidate };
}
