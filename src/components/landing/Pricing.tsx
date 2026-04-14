import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Loader2, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLandingContent, defaultLandingContent } from "@/hooks/useLandingContent";
import { TrialRequestDialog } from "./TrialRequestDialog";
import { useTranslation } from "react-i18next";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  stripe_product_id: string;
  stripe_price_id: string;
  max_users: number;
  max_branches: number;
  max_shipments_month: number;
  price_monthly: number;
  features: string[];
  display_order: number;
}

const Pricing = () => {
  const { data: landingContent } = useLandingContent();
  const generalContent = landingContent?.general || defaultLandingContent.general!;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | undefined>();
  const { t } = useTranslation('landing');

  const { data: plans, isLoading } = useQuery({
    queryKey: ["public-subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .eq("visible_in_landing", true)
        .order("display_order");
      
      if (error) throw error;
      return (data || []).map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features as string || "[]"),
      })) as SubscriptionPlan[];
    },
  });

  const formatPrice = (price: number) => {
    return price.toLocaleString("es-AR");
  };

  const formatLimit = (limit: number) => {
    return limit === -1 ? "∞" : limit.toString();
  };

  const handleRequestTrial = (planName?: string) => {
    setSelectedPlan(planName);
    setDialogOpen(true);
  };

  return (
    <section id="pricing" className="relative py-32 overflow-hidden bg-background dark:bg-[#050507]">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-[hsl(var(--geo-teal)/0.03)] rounded-full blur-[200px] opacity-50 dark:opacity-100" />

      <div className="container relative z-10 mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-20">
          <h2 className="text-5xl lg:text-6xl font-bold text-foreground dark:text-white mb-6 tracking-tight">
            {t('pricing.title')}
            <span className="bg-gradient-to-r from-[hsl(var(--geo-teal))] to-[hsl(var(--geo-cyan))] bg-clip-text text-transparent">{t('pricing.titleHighlight')}</span>
          </h2>
          <p className="text-xl text-muted-foreground dark:text-gray-400">
            {generalContent.pricing_subtitle}
          </p>
        </div>

        {isLoading && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--geo-teal))]" />
          </div>
        )}

        {plans && plans.length > 0 && (
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {plans.map((plan, i) => {
              const isPopular = i === 1 || plan.name.toLowerCase().includes("pro");
              
              return (
                <div 
                  key={plan.id}
                  className={`relative group ${isPopular ? 'md:-mt-6 md:mb-6' : ''}`}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                      <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-[hsl(var(--geo-teal))] to-[hsl(var(--geo-blue))] shadow-lg shadow-[hsl(var(--geo-teal)/0.25)]">
                        <Sparkles className="h-4 w-4 text-white" />
                        <span className="text-white text-sm font-medium">{t('pricing.popular')}</span>
                      </div>
                    </div>
                  )}

                  <div className={`h-full p-8 rounded-2xl border transition-all duration-500 ${
                    isPopular 
                      ? "bg-gradient-to-b from-[hsl(var(--geo-teal)/0.05)] to-transparent border-[hsl(var(--geo-teal)/0.3)]" 
                      : "bg-muted/50 dark:bg-white/[0.02] border-border dark:border-white/5 hover:border-border/80 dark:hover:border-white/10"
                  }`}>
                    <div className="mb-8">
                      <h3 className="text-2xl font-bold text-foreground dark:text-white mb-2">{plan.name}</h3>
                      <p className="text-muted-foreground dark:text-gray-500 text-sm">{plan.description}</p>
                    </div>

                    <div className="mb-8">
                      <div className="flex items-baseline gap-1">
                        <span className="text-muted-foreground dark:text-gray-500 text-lg">$</span>
                        <span className="text-5xl font-bold text-foreground dark:text-white">
                          {formatPrice(plan.price_monthly)}
                        </span>
                      </div>
                      <span className="text-muted-foreground/70 dark:text-gray-600 text-sm">{t('pricing.perMonth')} · {generalContent.currency_label}</span>
                    </div>

                    <div className="flex items-center justify-between py-4 border-y border-border dark:border-white/5 mb-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground dark:text-white">{formatLimit(plan.max_shipments_month)}</p>
                        <p className="text-xs text-muted-foreground dark:text-gray-500">{t('pricing.shipmentsMonth')}</p>
                      </div>
                      <div className="h-8 w-px bg-border dark:bg-white/10" />
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground dark:text-white">{formatLimit(plan.max_branches)}</p>
                        <p className="text-xs text-muted-foreground dark:text-gray-500">{t('pricing.branches')}</p>
                      </div>
                      <div className="h-8 w-px bg-border dark:bg-white/10" />
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground dark:text-white">{formatLimit(plan.max_users)}</p>
                        <p className="text-xs text-muted-foreground dark:text-gray-500">{t('pricing.users')}</p>
                      </div>
                    </div>

                    <ul className="space-y-3 mb-8">
                      {plan.features.slice(0, 5).map((feature, j) => (
                        <li key={j} className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-[hsl(var(--geo-teal))] flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground dark:text-gray-400 text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button 
                      onClick={() => handleRequestTrial(plan.name)}
                      className={`w-full py-6 rounded-xl font-medium transition-all duration-300 group ${
                        isPopular 
                          ? "bg-foreground dark:bg-white text-background dark:text-black hover:bg-foreground/90 dark:hover:bg-gray-100" 
                          : "bg-muted dark:bg-white/5 text-foreground dark:text-white hover:bg-muted/80 dark:hover:bg-white/10 border border-border dark:border-white/10"
                      }`}
                      size="lg"
                    >
                      {t('pricing.startTrial')}
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-center mt-16">
          <p className="text-muted-foreground/70 dark:text-gray-600 text-sm">
            {generalContent.trial_text}. {t('pricing.noCreditCard')}
          </p>
        </div>
      </div>

      <TrialRequestDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
        planName={selectedPlan}
      />
    </section>
  );
};

export default Pricing;
