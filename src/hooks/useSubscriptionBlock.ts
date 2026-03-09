import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type BlockReason = "trial_expired" | "subscription_expired" | null;

interface SubscriptionBlockResult {
  isBlocked: boolean;
  isLoading: boolean;
  reason: BlockReason;
}

export function useSubscriptionBlock(): SubscriptionBlockResult {
  const { user, profile, isSuperAdmin } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["subscription-block", profile?.tenant_id],
    queryFn: async (): Promise<{ isBlocked: boolean; reason: BlockReason }> => {
      if (!profile?.tenant_id) {
        return { isBlocked: false, reason: null };
      }

      // Fetch tenant info
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("plan, trial_ends_at")
        .eq("id", profile.tenant_id)
        .single();

      if (tenantError || !tenant) {
        return { isBlocked: false, reason: null };
      }

      const now = new Date();

      // Check trial expiration
      if (tenant.plan === "trial") {
        if (tenant.trial_ends_at && new Date(tenant.trial_ends_at) <= now) {
          return { isBlocked: true, reason: "trial_expired" };
        }
        // Trial still active
        return { isBlocked: false, reason: null };
      }

      // For non-trial plans, check tenant_subscriptions
      const { data: subscription } = await supabase
        .from("tenant_subscriptions")
        .select("status, current_period_end")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // No subscription record → allow access (tenant without configured plan)
      if (!subscription) {
        return { isBlocked: false, reason: null };
      }

      // Subscription inactive or expired
      if (
        subscription.status !== "active" ||
        (subscription.current_period_end && new Date(subscription.current_period_end) < now)
      ) {
        return { isBlocked: true, reason: "subscription_expired" };
      }

      return { isBlocked: false, reason: null };
    },
    enabled: !!user && !!profile?.tenant_id,
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  // Super admins are never blocked
  if (isSuperAdmin()) {
    return { isBlocked: false, isLoading: false, reason: null };
  }

  return {
    isBlocked: data?.isBlocked ?? false,
    isLoading,
    reason: data?.reason ?? null,
  };
}
