import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

  return (
    <section id="clients" className="relative py-24 overflow-hidden bg-[#050507]">
      {/* Divider line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      <div className="container relative z-10 mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-sm uppercase tracking-[0.3em] text-gray-500 font-medium">
            Empresas que confían en nosotros
          </p>
        </div>

        {/* Infinite scroll container */}
        <div className="relative overflow-hidden">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#050507] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#050507] to-transparent z-10 pointer-events-none" />
          
          {/* Scrolling logos */}
          <div className="flex animate-marquee">
            {/* First set */}
            {clients.map((client) => (
              <div 
                key={client.id}
                className="flex-shrink-0 mx-12 group"
              >
                <div className="h-16 w-40 flex items-center justify-center grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                  <img 
                    src={client.tenant_branding?.logo_dark || client.tenant_branding?.logo_light || ''} 
                    alt={client.nombre}
                    className="max-h-12 max-w-full object-contain"
                    loading="lazy"
                  />
                </div>
              </div>
            ))}
            {/* Duplicate for seamless loop */}
            {clients.map((client) => (
              <div 
                key={`dup-${client.id}`}
                className="flex-shrink-0 mx-12 group"
              >
                <div className="h-16 w-40 flex items-center justify-center grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                  <img 
                    src={client.tenant_branding?.logo_dark || client.tenant_branding?.logo_light || ''} 
                    alt={client.nombre}
                    className="max-h-12 max-w-full object-contain"
                    loading="lazy"
                  />
                </div>
              </div>
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
