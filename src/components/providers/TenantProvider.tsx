import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useTenant, Tenant, TenantBranding, hexToHsl } from '@/hooks/useTenant';

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

export function TenantProvider({ children }: TenantProviderProps) {
  const { tenant, branding, isLoading } = useTenant();

  // Apply branding CSS variables when branding changes
  useEffect(() => {
    if (!branding) return;

    const root = document.documentElement;

    // Apply custom colors as CSS variables
    if (branding.color_primario) {
      root.style.setProperty('--primary', hexToHsl(branding.color_primario));
    }
    if (branding.color_primario_foreground) {
      root.style.setProperty('--primary-foreground', hexToHsl(branding.color_primario_foreground));
    }
    if (branding.color_acento) {
      root.style.setProperty('--accent', hexToHsl(branding.color_acento));
    }
    if (branding.color_sidebar) {
      root.style.setProperty('--sidebar-background', hexToHsl(branding.color_sidebar));
    }

    // Update page title
    if (branding.nombre_app) {
      document.title = branding.meta_title || branding.nombre_app;
    }

    // Update meta description
    if (branding.meta_description) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', branding.meta_description);
    }

    // Update favicon
    if (branding.favicon) {
      let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (favicon) {
        favicon.href = branding.favicon;
      }
    }

    // Apply custom CSS
    if (branding.custom_css) {
      let styleEl = document.getElementById('tenant-custom-css');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'tenant-custom-css';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = branding.custom_css;
    }

    // Cleanup function to remove custom styles when component unmounts
    return () => {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--primary-foreground');
      root.style.removeProperty('--accent');
      root.style.removeProperty('--sidebar-background');
      
      const customStyle = document.getElementById('tenant-custom-css');
      if (customStyle) {
        customStyle.remove();
      }
    };
  }, [branding]);

  return (
    <TenantContext.Provider value={{ tenant, branding, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}
