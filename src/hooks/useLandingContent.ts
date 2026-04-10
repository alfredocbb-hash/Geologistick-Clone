import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HeroContent {
  badge_text: string;
  title_line1: string;
  title_line2: string;
  description: string;
  cta_primary: string;
  cta_secondary: string;
  stats: Array<{ value: string; label: string; icon: string }>;
}

export interface FeaturesContent {
  badge_text: string;
  title: string;
  subtitle: string;
  contact_text: string;
  contact_cta: string;
}

export interface GeneralContent {
  trial_days: number;
  trial_text: string;
  pricing_title: string;
  pricing_subtitle: string;
  currency_label: string;
  contact_email: string;
}

export interface AboutContent {
  title: string;
  description: string;
  who_we_are: string;
  mission: string;
  vision: string;
}

export interface LandingContent {
  hero?: HeroContent;
  features?: FeaturesContent;
  general?: GeneralContent;
  about?: AboutContent;
}

// Default values for fallback
export const defaultLandingContent: LandingContent = {
  hero: {
    badge_text: "Plataforma #1 de Logística en Argentina",
    title_line1: "Software de",
    title_line2: "logística inteligente",
    description: "Gestioná envíos, choferes, rutas y liquidaciones desde un solo lugar. Tracking en tiempo real, integración con Mercado Libre y Tiendanube, y app móvil para choferes.",
    cta_primary: "Comenzar gratis",
    cta_secondary: "Ver demo",
    stats: [
      { value: "+50K", label: "Envíos/mes", icon: "Package" },
      { value: "99.9%", label: "Uptime", icon: "Shield" },
      { value: "< 2s", label: "Tiempo respuesta", icon: "Zap" }
    ]
  },
  features: {
    badge_text: "Potenciado por tecnología de punta",
    title: "Funcionalidades completas",
    subtitle: "Herramientas profesionales diseñadas para empresas de logística que quieren digitalizar y escalar su operación.",
    contact_text: "¿Necesitas una integración especial?",
    contact_cta: "Hablemos de tu caso"
  },
  general: {
    trial_days: 14,
    trial_text: "14 días gratis en todos los planes",
    pricing_title: "Precios transparentes",
    pricing_subtitle: "Sin sorpresas ni costos ocultos. Escala cuando lo necesites.",
    currency_label: "ARS",
    contact_email: "soporte@geologistick.com"
  },
  about: {
    title: "¿Quiénes somos?",
    description: "Somos una empresa de tecnología especializada en soluciones logísticas. Desarrollamos software que simplifica la gestión de envíos, optimiza rutas y automatiza procesos para empresas de courier y distribución.",
    who_we_are: "Geologistick nació de la necesidad de digitalizar la logística de última milla en Argentina. Combinamos tecnología de punta con experiencia operativa real para ofrecer una plataforma integral que resuelve los desafíos diarios de las empresas de distribución.",
    mission: "Simplificar la logística para que las empresas puedan enfocarse en crecer. Creemos que la tecnología debe ser accesible, intuitiva y generar resultados reales desde el primer día.",
    vision: "Ser la plataforma de referencia para la gestión logística en Latinoamérica, impulsando la transformación digital del sector con innovación continua y un enfoque centrado en el usuario.",
  }
};

export function useLandingContent() {
  return useQuery({
    queryKey: ["landing-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_content")
        .select("*");
      
      if (error) throw error;
      
      // Convert array to object by section
      const content = (data || []).reduce((acc, row) => {
        acc[row.section] = row.content;
        return acc;
      }, {} as Record<string, any>);
      
      // Merge with defaults
      return {
        hero: { ...defaultLandingContent.hero, ...content.hero },
        features: { ...defaultLandingContent.features, ...content.features },
        general: { ...defaultLandingContent.general, ...content.general },
        about: { ...defaultLandingContent.about, ...content.about },
      } as LandingContent;
    },
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
  });
}

export function useUpdateLandingContent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ section, content }: { section: string; content: any }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("landing_content")
        .update({ 
          content,
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq("section", section);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-content"] });
    }
  });
}
