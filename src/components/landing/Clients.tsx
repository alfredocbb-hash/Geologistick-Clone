import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "next-themes";

interface ClientWithBranding {
  id: string;
  nombre: string;
  slug: string;
  tenant_branding: {
    logo_light: string | null;
    logo_dark: string | null;
  } | null;
}

const Clients = () => {
  const { resolvedTheme } = useTheme();
  
  const { data: clients } = useQuery({
    queryKey: ['landing-clients'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenants')
        .select(`
          id, 
          nombre, 
          slug,
          tenant_branding (
            logo_light, 
            logo_dark
          )
        `)
        .eq('activo', true);
      
      // Filter only those with logos
      return (data || []).filter(t => 
        t.tenant_branding?.logo_light || 
        t.tenant_branding?.logo_dark
      ) as ClientWithBranding[];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  if (!clients || clients.length === 0) {
    return null;
  }

  const getLogoSrc = (client: ClientWithBranding) => {
    if (resolvedTheme === 'dark') {
      return client.tenant_branding?.logo_dark || client.tenant_branding?.logo_light || '';
    }
    return client.tenant_branding?.logo_light || client.tenant_branding?.logo_dark || '';
  };

  return (
    <section id="clients" className="relative py-24 overflow-hidden bg-muted dark:bg-[#050507]">
      {/* Divider line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-border dark:via-white/10 to-transparent" />
      
      <div className="container relative z-10 mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground dark:text-gray-500 font-medium">
            Empresas que confían en nosotros
          </p>
        </div>

        {/* Infinite scroll container */}
        <div className="relative overflow-hidden">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-muted dark:from-[#050507] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-muted dark:from-[#050507] to-transparent z-10 pointer-events-none" />
          
          {/* Scrolling logos - 4x duplicated for smooth infinite scroll */}
          <div className="flex animate-marquee items-center">
            {[...Array(4)].map((_, setIndex) => (
              clients.map((client) => (
                <div 
                  key={`set-${setIndex}-${client.id}`}
                  className="flex-shrink-0 mx-16 group"
                >
                  <div className="h-24 w-52 flex items-center justify-center grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                    <img 
                      src={getLogoSrc(client)} 
                      alt={client.nombre}
                      className="max-h-20 max-w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                </div>
              ))
            ))}
          </div>
        </div>
      </div>

      {/* CSS for marquee animation */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
};

export default Clients;
