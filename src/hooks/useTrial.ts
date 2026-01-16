import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface TrialData {
  isOnTrial: boolean;
  trialEndsAt: Date | null;
  daysRemaining: number;
  isTrialExpired: boolean;
  hasActiveSubscription: boolean;
}

export function useTrial() {
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["trial-status", user?.id],
    queryFn: async (): Promise<TrialData> => {
      if (!user?.id) {
        return {
          isOnTrial: false,
          trialEndsAt: null,
          daysRemaining: 0,
          isTrialExpired: false,
          hasActiveSubscription: false,
        };
      }

      // Get profile to get tenant_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.tenant_id) {
        return {
          isOnTrial: false,
          trialEndsAt: null,
          daysRemaining: 0,
          isTrialExpired: false,
          hasActiveSubscription: false,
        };
      }

      // Get tenant data
      const { data: tenant, error } = await supabase
        .from("tenants")
        .select("plan, trial_ends_at, stripe_subscription_id")
        .eq("id", profile.tenant_id)
        .single();

      if (error || !tenant) {
        console.error("Error fetching tenant trial data:", error);
        return {
          isOnTrial: false,
          trialEndsAt: null,
          daysRemaining: 0,
          isTrialExpired: false,
          hasActiveSubscription: false,
        };
      }

      const now = new Date();
      const trialEndsAt = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
      const hasActiveSubscription = !!tenant.stripe_subscription_id && tenant.plan !== "trial";
      
      // Calculate days remaining
      let daysRemaining = 0;
      if (trialEndsAt) {
        daysRemaining = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      }

      const isOnTrial = tenant.plan === "trial" && trialEndsAt !== null && trialEndsAt > now;
      const isTrialExpired = tenant.plan === "trial" && trialEndsAt !== null && trialEndsAt <= now;

      return {
        isOnTrial,
        trialEndsAt,
        daysRemaining,
        isTrialExpired,
        hasActiveSubscription,
      };
    },
    enabled: !!user,
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000,
  });

  return {
    isOnTrial: data?.isOnTrial ?? false,
    trialEndsAt: data?.trialEndsAt ?? null,
    daysRemaining: data?.daysRemaining ?? 0,
    isTrialExpired: data?.isTrialExpired ?? false,
    hasActiveSubscription: data?.hasActiveSubscription ?? false,
    isLoading,
    refetch,
  };
}