import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useTenant, Tenant, TenantBranding } from '@/hooks/useTenant';

interface TenantContextType {
  tenant: Tenant | null | undefined;
  branding: TenantBranding | null | undefined;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  branding: null,
  isLoading: true,
});

export function useTenantContext() {
  return useContext(TenantContext);
}

interface TenantProviderProps {
  children: ReactNode;
}

/**
 * TenantProvider — aplica sólo IDENTIDAD por tenant (logo, favicon, título, meta,
 * CSS opcional). La paleta de colores es global y vive en src/index.css; no se
 * deriva por tenant para garantizar consistencia visual entre todos los clientes.
 */
export function TenantProvider({ children }: TenantProviderProps) {
  const { tenant, branding, isLoading } = useTenant();

  useEffect(() => {
    if (!branding) return;

    // Page title
    if (branding.nombre_app) {
      document.title = branding.meta_title || branding.nombre_app;
    }

    // Meta description
    if (branding.meta_description) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', branding.meta_description);
    }

    // Favicon
    if (branding.favicon) {
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      if (favicon) favicon.href = branding.favicon;
    }

    // Custom CSS (opcional, sólo para ajustes puntuales; no debe redefinir la paleta global)
    if (branding.custom_css) {
      let styleEl = document.getElementById('tenant-custom-css');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'tenant-custom-css';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = branding.custom_css;
    }

    return () => {
      const customStyle = document.getElementById('tenant-custom-css');
      if (customStyle) customStyle.remove();
    };
  }, [branding]);

  return (
    <TenantContext.Provider value={{ tenant, branding, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}
