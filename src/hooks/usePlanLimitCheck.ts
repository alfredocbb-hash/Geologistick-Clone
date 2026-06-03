import { supabase } from '@/integrations/supabase/client';

export type PlanLimitType = 'users' | 'branches';

export interface PlanLimitCheckResult {
  canActivate: boolean;
  current: number;
  max: number;
  planName: string;
}

/**
 * Validates whether activating one more user/branch would exceed
 * the tenant's contracted plan limits.
 *
 * Prefers active subscription (tenant_subscriptions + subscription_plans)
 * with fallback to tenants.max_usuarios / max_sucursales.
 */
export function usePlanLimitCheck() {
  const checkBeforeActivate = async (
    tenantId: string,
    type: PlanLimitType
  ): Promise<PlanLimitCheckResult> => {
    let max = 0;
    let planName = 'Plan actual';

    // Try active subscription first
    const { data: subDetails } = await supabase
      .rpc('get_tenant_subscription_details', { p_tenant_id: tenantId });

    const activeSub = Array.isArray(subDetails)
      ? subDetails.find((s: any) => s.status === 'active' || s.status === 'trialing')
      : null;

    if (activeSub) {
      planName = activeSub.plan_name || planName;
      max = type === 'users' ? activeSub.max_users : activeSub.max_branches;
    } else {
      // Fallback to tenants table
      const { data: tenant } = await supabase
        .from('tenants')
        .select('plan, max_usuarios, max_sucursales')
        .eq('id', tenantId)
        .maybeSingle();

      if (tenant) {
        planName = tenant.plan || planName;
        max = type === 'users' ? tenant.max_usuarios : tenant.max_sucursales;
      }
    }

    // -1 means unlimited
    if (max === -1) {
      return { canActivate: true, current: 0, max: -1, planName };
    }

    // Count currently active resources
    let current = 0;
    if (type === 'users') {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('activo', true);
      current = count || 0;
    } else {
      const { count } = await supabase
        .from('sucursales')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('activa', true);
      current = count || 0;
    }

    return {
      canActivate: current < max,
      current,
      max,
      planName,
    };
  };

  return { checkBeforeActivate };
}
