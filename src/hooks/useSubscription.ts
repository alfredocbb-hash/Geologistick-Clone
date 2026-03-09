import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface SubscriptionLimits {
  max_users: number;
  max_branches: number;
  max_shipments_month: number;
}

export interface SubscriptionUsage {
  shipments_count: number;
  users_count: number;
  branches_count: number;
}

export interface SubscriptionData {
  subscribed: boolean;
  plan_name?: string;
  product_id?: string;
  price_id?: string;
  subscription_end?: string;
  cancel_at_period_end?: boolean;
  limits?: SubscriptionLimits;
  usage?: SubscriptionUsage;
  error?: string;
  payment_method?: "stripe" | "mercadopago";
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  stripe_product_id: string;
  stripe_price_id: string;
  mercadopago_plan_id?: string | null;
  max_users: number;
  max_branches: number;
  max_shipments_month: number;
  price_monthly: number;
  features: string[];
  display_order: number;
}

export function useSubscription() {
  const { user, session } = useAuth();

  const { data: subscription, isLoading: isLoadingSubscription, refetch: refetchSubscription } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async (): Promise<SubscriptionData> => {
      // Try Mercado Pago first
      const { data: mpData, error: mpError } = await supabase.functions.invoke("mp-check-subscription");
      if (!mpError && mpData && mpData.subscribed) {
        return mpData as SubscriptionData;
      }

      // Fallback to Stripe check
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      return data as SubscriptionData;
    },
    enabled: !!user && !!session,
    refetchInterval: 60000,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const { data: plans, isLoading: isLoadingPlans } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async (): Promise<SubscriptionPlan[]> => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      
      if (error) throw error;
      return (data || []).map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features as string || "[]"),
      }));
    },
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const createCheckoutMP = async (planId: string) => {
    const { data, error } = await supabase.functions.invoke("mp-create-subscription", {
      body: { planId },
    });
    if (error) throw error;
    if (data?.url) {
      window.open(data.url, "_blank");
    }
    return data;
  };

  const createCheckoutStripe = async (priceId: string) => {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { priceId },
    });
    if (error) throw error;
    if (data?.url) {
      window.open(data.url, "_blank");
    }
    return data;
  };

  const cancelSubscription = async () => {
    const { data, error } = await supabase.functions.invoke("mp-cancel-subscription");
    if (error) throw error;
    return data;
  };

  const openCustomerPortal = async () => {
    // For Stripe subscriptions
    const { data, error } = await supabase.functions.invoke("customer-portal");
    if (error) throw error;
    if (data?.url) {
      window.open(data.url, "_blank");
    }
    return data;
  };

  const isWithinLimits = (type: "users" | "branches" | "shipments"): boolean => {
    if (!subscription?.subscribed || !subscription.limits || !subscription.usage) {
      return true; // Allow if no subscription data (free tier or no limits)
    }

    const limits = subscription.limits;
    const usage = subscription.usage;

    switch (type) {
      case "users":
        return limits.max_users === -1 || usage.users_count < limits.max_users;
      case "branches":
        return limits.max_branches === -1 || usage.branches_count < limits.max_branches;
      case "shipments":
        return limits.max_shipments_month === -1 || usage.shipments_count < limits.max_shipments_month;
      default:
        return true;
    }
  };

  const getUsagePercentage = (type: "users" | "branches" | "shipments"): number => {
    if (!subscription?.subscribed || !subscription.limits || !subscription.usage) {
      return 0;
    }

    const limits = subscription.limits;
    const usage = subscription.usage;

    switch (type) {
      case "users":
        return limits.max_users === -1 ? 0 : (usage.users_count / limits.max_users) * 100;
      case "branches":
        return limits.max_branches === -1 ? 0 : (usage.branches_count / limits.max_branches) * 100;
      case "shipments":
        return limits.max_shipments_month === -1 ? 0 : (usage.shipments_count / limits.max_shipments_month) * 100;
      default:
        return 0;
    }
  };

  const daysRemaining = subscription?.subscription_end
    ? Math.max(0, Math.ceil((new Date(subscription.subscription_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return {
    subscription,
    plans,
    isLoading: isLoadingSubscription || isLoadingPlans,
    createCheckoutMP,
    createCheckoutStripe,
    cancelSubscription,
    openCustomerPortal,
    refetchSubscription,
    isWithinLimits,
    getUsagePercentage,
    daysRemaining,
  };
}
