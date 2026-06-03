import { useAuth } from '@/lib/auth';
import { useSuperAdminTenantFilter } from '@/components/providers/SuperAdminTenantFilterProvider';

/**
 * Devuelve el tenant_id efectivo para usar en queries.
 * - Para super_admin: el tenant globalmente seleccionado (o el override local). null = "Todos".
 * - Para el resto: siempre su propio tenant.
 *
 * Incluí el valor devuelto en el queryKey para refetch al cambiar.
 */
export function useEffectiveTenantId(localOverride?: string | 'all' | null): string | null {
  const { profile, isSuperAdmin } = useAuth();
  const { selectedTenantId } = useSuperAdminTenantFilter();

  if (isSuperAdmin()) {
    const effective =
      localOverride !== undefined && localOverride !== null ? localOverride : selectedTenantId;
    return effective === 'all' ? null : effective;
  }
  return profile?.tenant_id ?? null;
}
