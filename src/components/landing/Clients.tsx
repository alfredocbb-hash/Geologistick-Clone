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
  const { data: clients, isLoading } = useQuery({
    queryKey: ['landing-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
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
      
      if (error) throw error;
      
      // Filter only tenants with logos
      return (data as ClientWithBranding[])?.filter(t => 
        t.tenant_branding?.logo_light || 
        t.tenant_branding?.logo_dark
      ) || [];
    }
  });

  if (isLoading || !clients?.length) return null;

  return (
    <section id="clients" className="relative py-20 bg-[#0a0a0f]">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[hsl(var(--geo-dark)/0.3)] to-transparent" />
      
      <div className="container relative z-10 mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Empresas que confían en{" "}
            <span className="bg-gradient-to-r from-[hsl(var(--geo-teal))] to-[hsl(var(--geo-cyan))] bg-clip-text text-transparent">
              Geologistick
            </span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Procesamos miles de envíos para negocios de logística en toda Argentina
          </p>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-16">
          {clients.map((client) => {
            const logoUrl = client.tenant_branding?.logo_light || client.tenant_branding?.logo_dark;
            
            return (
              <div
                key={client.id}
                className="group relative flex items-center justify-center p-6 rounded-2xl bg-white/5 border border-gray-800 hover:border-[hsl(var(--geo-teal)/0.5)] transition-all duration-300 hover:bg-white/10"
              >
                <img
                  src={logoUrl!}
                  alt={`Logo de ${client.nombre}`}
                  className="h-12 max-w-[160px] object-contain filter grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
                  loading="lazy"
                />
                {/* Tooltip with company name */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="px-3 py-1.5 rounded-lg bg-[hsl(var(--geo-dark))] border border-gray-700 shadow-lg">
                    <span className="text-sm text-white whitespace-nowrap">{client.nombre}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Decorative line */}
        <div className="mt-16 flex items-center justify-center">
          <div className="h-px w-24 bg-gradient-to-r from-transparent to-[hsl(var(--geo-teal)/0.5)]" />
          <div className="px-4">
            <span className="text-gray-500 text-sm">+{clients.length} empresas activas</span>
          </div>
          <div className="h-px w-24 bg-gradient-to-l from-transparent to-[hsl(var(--geo-teal)/0.5)]" />
        </div>
      </div>
    </section>
  );
};

export default Clients;
