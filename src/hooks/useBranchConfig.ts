import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface BranchConfig {
  realizaEntregas: boolean;
  realizaRetiros: boolean;
  puedeDespachar: boolean;
  puedeRecibir: boolean;
  sucursal: {
    id: string;
    nombre: string;
    codigo: string | null;
  } | null;
  isLoading: boolean;
}

export function useBranchConfig(): BranchConfig {
  const { profile, isSuperAdmin, isAdmin } = useAuth();

  const { data: sucursal, isLoading } = useQuery({
    queryKey: ['branch-config', profile?.sucursal_id],
    queryFn: async () => {
      if (!profile?.sucursal_id) return null;

      const { data, error } = await supabase
        .from('sucursales')
        .select('id, nombre, codigo, realiza_entregas, realiza_retiros, puede_despachar, puede_recibir')
        .eq('id', profile.sucursal_id)
        .single();

      if (error) {
        console.error('Error fetching branch config:', error);
        return null;
      }

      return data;
    },
    enabled: !!profile?.sucursal_id,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Super admin or admin without branch can see everything
  const isAdminWithoutBranch = (isSuperAdmin() || isAdmin?.()) && !profile?.sucursal_id;

  return {
    realizaEntregas: isAdminWithoutBranch || sucursal?.realiza_entregas || false,
    realizaRetiros: isAdminWithoutBranch || sucursal?.realiza_retiros || false,
    puedeDespachar: isAdminWithoutBranch || sucursal?.puede_despachar || false,
    puedeRecibir: isAdminWithoutBranch || sucursal?.puede_recibir || false,
    sucursal: sucursal ? {
      id: sucursal.id,
      nombre: sucursal.nombre,
      codigo: sucursal.codigo,
    } : null,
    isLoading,
  };
}
