import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface Tenant {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
  favicon_url: string | null;
  color_primario: string;
  color_secundario: string;
  color_acento: string;
  plan: string;
  activo: boolean;
  trial_ends_at: string | null;
  max_usuarios: number;
  max_sucursales: number;
  max_envios_mes: number;
  configuracion: Record<string, unknown>;
  created_at: string;
  ecommerce_enabled?: boolean;
  modo_flex?: boolean;
  planificador_enabled?: boolean;
}

export interface TenantBranding {
  id: string;
  tenant_id: string;
  nombre_app: string;
  logo_light: string | null;
  logo_dark: string | null;
  favicon: string | null;
  color_primario: string;
  color_primario_foreground: string;
  color_secundario: string;
  color_acento: string;
  color_fondo: string;
  color_fondo_dark: string;
  color_sidebar: string;
  color_sidebar_dark: string;
  custom_css: string | null;
  footer_text: string | null;
  support_email: string | null;
  support_phone: string | null;
  custom_domain: string | null;
  meta_title: string | null;
  meta_description: string | null;
  // Contact & Social Media
  company_address: string | null;
  company_city: string | null;
  company_country: string | null;
  company_description: string | null;
  social_twitter: string | null;
  social_linkedin: string | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_whatsapp: string | null;
}

export function useTenant() {
  const { user, profile, isSuperAdmin } = useAuth();
  const tenantId = (profile as { tenant_id?: string })?.tenant_id;

  // Super Admin siempre ve branding por defecto de Geologistick
  const shouldLoadBranding = !isSuperAdmin();

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();
      
      if (error) throw error;
      return data as Tenant;
    },
    enabled: !!user && !!tenantId && shouldLoadBranding,
    refetchOnWindowFocus: false,
  });

  const { data: branding, isLoading: brandingLoading } = useQuery({
    queryKey: ['tenant-branding', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .from('tenant_branding')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as TenantBranding | null;
    },
    enabled: !!user && !!tenantId && shouldLoadBranding,
    refetchOnWindowFocus: false,
  });

  return {
    tenant,
    branding,
    tenantId,
    isLoading: shouldLoadBranding ? (tenantLoading || brandingLoading) : false,
  };
}

// Helper to convert hex to HSL
export function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0 0% 0%';

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
