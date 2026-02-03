import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Zap, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLandingContent, defaultLandingContent } from "@/hooks/useLandingContent";
import { TrialRequestDialog } from "./TrialRequestDialog";

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

const gradients: Record<string, string> = {
  "Starter": "from-slate-500 to-slate-600",
  "Pro": "from-primary to-purple-600",
  "Enterprise": "from-amber-500 to-orange-600",
};

const Pricing = () => {
  const { data: landingContent } = useLandingContent();
  const generalContent = landingContent?.general || defaultLandingContent.general!;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | undefined>();

  const { data: plans, isLoading } = useQuery({
    queryKey: ["public-subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      
      if (error) throw error;
      return (data || []).map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features as string || "[]"),
      })) as SubscriptionPlan[];
    },
  });

  const getGradient = (name: string, index: number) => {
    if (gradients[name]) return gradients[name];
    const fallbacks = ["from-slate-500 to-slate-600", "from-primary to-purple-600", "from-amber-500 to-orange-600"];
    return fallbacks[index % fallbacks.length];
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString("es-AR");
  };

  const formatLimit = (limit: number) => {
    return limit === -1 ? "Ilimitados" : limit.toString();
  };

  const handleRequestTrial = (planName?: string) => {
    setSelectedPlan(planName);
    setDialogOpen(true);
  };

  return (
    <section id="pricing" className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#0a0a0f]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a1a2e_1px,transparent_1px),linear-gradient(to_bottom,#1a1a2e_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[150px]" />

      <div className="container relative z-10 mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">{generalContent.trial_text}</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            {generalContent.pricing_title.split(" ")[0]}{" "}
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              {generalContent.pricing_title.split(" ").slice(1).join(" ") || "transparentes"}
            </span>
          </h2>
          <p className="text-xl text-gray-400">
            {generalContent.pricing_subtitle}
          </p>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Pricing cards */}
        {plans && plans.length > 0 && (
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, i) => {
              const isPopular = i === 1 || plan.name.toLowerCase().includes("pro");
              const gradient = getGradient(plan.name, i);
              
              return (
                <div 
                  key={plan.id}
                  className={`relative group ${isPopular ? 'md:-mt-4 md:mb-4' : ''}`}
                >
                  {/* Popular badge */}
                  {isPopular && (
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                      <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary to-purple-600 shadow-lg shadow-primary/25">
                        <Sparkles className="h-4 w-4 text-white" />
                        <span className="text-white text-sm font-semibold">Más popular</span>
                      </div>
                    </div>
                  )}

                  {/* Card */}
                  <div className={`h-full p-8 rounded-2xl border transition-all duration-500 ${
                    isPopular 
                      ? "bg-gradient-to-b from-primary/10 to-purple-900/10 border-primary/50 shadow-2xl shadow-primary/10" 
                      : "bg-gray-900/50 border-gray-800 hover:border-gray-700"
                  }`}>
                    {/* Plan header */}
                    <div className="text-center mb-8">
                      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} mb-4`}>
                        <span className="text-white font-bold text-lg">{plan.name.charAt(0)}</span>
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                      <p className="text-gray-400 text-sm">{plan.description}</p>
                    </div>

                    {/* Price */}
                    <div className="text-center mb-8">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-gray-400">$</span>
                        <span className={`text-5xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
                          {formatPrice(plan.price_monthly)}
                        </span>
                      </div>
                      <span className="text-gray-500 text-sm">/mes · {generalContent.currency_label}</span>
                    </div>

                    {/* Dynamic limits */}
                    <div className="bg-gray-800/50 rounded-lg p-4 mb-6 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Envíos/mes</span>
                        <span className="text-white font-medium">{formatLimit(plan.max_shipments_month)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Sucursales</span>
                        <span className="text-white font-medium">{formatLimit(plan.max_branches)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Usuarios</span>
                        <span className="text-white font-medium">{formatLimit(plan.max_users)}</span>
                      </div>
                    </div>

                    {/* Features */}
                    <ul className="space-y-4 mb-8">
                      {plan.features.map((feature, j) => (
                        <li key={j} className="flex items-start gap-3">
                          <div className={`flex-shrink-0 h-5 w-5 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center mt-0.5`}>
                            <Check className="h-3 w-3 text-white" />
                          </div>
                          <span className="text-gray-300">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <Button 
                      onClick={() => handleRequestTrial(plan.name)}
                      className={`w-full py-6 text-lg font-semibold transition-all duration-300 ${
                        isPopular 
                          ? "bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30" 
                          : "bg-white/10 hover:bg-white/20 border border-gray-700"
                      }`}
                      size="lg"
                    >
                      Solicitar Prueba Gratuita
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom text */}
        <div className="text-center mt-16">
          <p className="text-gray-500 mb-2">
            Todos los precios en {generalContent.currency_label}. Facturamos mensualmente.
          </p>
          <p className="text-gray-400">
            ¿Necesitas un plan personalizado?{" "}
            <a href={`mailto:${generalContent.contact_email}`} className="text-primary hover:underline font-medium">
              Hablemos
            </a>
          </p>
        </div>
      </div>

      {/* Trial Request Dialog */}
      <TrialRequestDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
        planName={selectedPlan}
      />
    </section>
  );
};

export default Pricing;
