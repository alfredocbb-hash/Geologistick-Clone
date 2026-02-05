import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CTASection = () => {
  // Get count of active tenants via public RPC
  const { data: tenantCount } = useQuery({
    queryKey: ['active-tenants-count'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_active_tenant_count');
      if (error) {
        console.error('Error fetching tenant count:', error);
        return 0;
      }
      return data || 0;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  return (
    <section className="relative py-32 overflow-hidden bg-muted dark:bg-[#050507]">
      {/* Large gradient glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] rounded-full blur-[200px] opacity-30 dark:opacity-100"
        style={{
          background: 'radial-gradient(ellipse, hsl(174 50% 50% / 0.08) 0%, transparent 70%)'
        }}
      />

      <div className="container relative z-10 mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[hsl(var(--geo-teal)/0.3)] bg-[hsl(var(--geo-teal)/0.05)] backdrop-blur-xl mb-10">
            <Sparkles className="h-4 w-4 text-[hsl(var(--geo-teal))]" />
            <span className="text-sm font-medium text-[hsl(var(--geo-teal))]">
              Únete a {tenantCount && tenantCount > 3 ? `${tenantCount}+` : 'empresas'} que ya optimizan sus envíos
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-5xl lg:text-7xl font-bold text-foreground dark:text-white mb-8 tracking-tight leading-tight">
            ¿Listo para
            <br />
            <span className="bg-gradient-to-r from-[hsl(var(--geo-teal))] via-[hsl(var(--geo-cyan))] to-[hsl(var(--geo-blue))] bg-clip-text text-transparent">
              transformar tu logística?
            </span>
          </h2>

          {/* Subtitle */}
          <p className="text-xl text-muted-foreground dark:text-gray-400 max-w-2xl mx-auto mb-12">
            Comienza tu prueba gratuita hoy. Sin compromisos, sin tarjeta de crédito.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <Button 
              asChild 
              size="lg" 
              className="text-lg px-12 py-7 bg-foreground dark:bg-white text-background dark:text-black hover:bg-foreground/90 dark:hover:bg-gray-100 rounded-full font-semibold transition-all duration-300 hover:scale-105 shadow-2xl shadow-foreground/10 dark:shadow-white/10"
            >
              <Link to="/login">
                Comenzar ahora
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button 
              asChild 
              variant="ghost" 
              size="lg" 
              className="text-lg px-12 py-7 text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-white hover:bg-muted/80 dark:hover:bg-white/5 rounded-full font-medium"
            >
              <a href="#pricing">
                Ver planes
              </a>
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-8 mt-16 text-sm text-muted-foreground/70 dark:text-gray-600">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>Setup en 5 min</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>Sin tarjeta</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>Soporte 24/7</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
