import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

/**
 * Devuelve si el tenant actual tiene habilitado un feature opcional.
 * super_admin siempre lo ve como habilitado.
 */
export function useTenantFeature(featureKey: string): { enabled: boolean; isLoading: boolean } {
  const { profile, isSuperAdmin } = useAuth();
  const tenantId = profile?.tenant_id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-feature', tenantId, featureKey],
    queryFn: async () => {
      if (!tenantId) return false;
      const { data, error } = await (supabase as any)
        .from('tenant_features')
        .select('enabled')
        .eq('tenant_id', tenantId)
        .eq('feature_key', featureKey)
        .maybeSingle();
      if (error) return false;
      return !!data?.enabled;
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  return {
    enabled: isSuperAdmin() ? true : !!data,
    isLoading,
  };
}
