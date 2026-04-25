import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

/** Extrae el Hue (0-360) de un string HSL "H S% L%". */
function parseHue(hslString: string): number {
  const match = /^(\d+)\s/.exec(hslString);
  return match ? parseInt(match[1], 10) : 217;
}

/** Extrae la luminosidad (0-100) de un string HSL "H S% L%". */
function parseLightness(hslString: string): number {
  const match = /\s(\d+)%\s+(\d+)%$/.exec(hslString);
  return match ? parseInt(match[2], 10) : 50;
}

/**
 * Construye una paleta completa para el sidebar derivada del Hue del color primario,
 * adaptada al fondo real (claro u oscuro) para garantizar buen contraste.
 *
 * Si hay un explicitSidebarBg, se determina si es claro u oscuro por su lightness
 * y se eligen foreground/accent/border compatibles, ignorando isDark global.
 */
function buildSidebarPalette(primaryHsl: string, isDark: boolean, explicitSidebarBg?: string) {
  const h = parseHue(primaryHsl);

  // Si hay fondo explícito, decidir paleta según su luminosidad real
  if (explicitSidebarBg) {
    const bgLightness = parseLightness(explicitSidebarBg);
    const bgIsDark = bgLightness < 50;

    if (bgIsDark) {
      return {
        background: explicitSidebarBg,
        foreground: `0 0% 98%`,
        primary: primaryHsl,
        primaryForeground: `0 0% 100%`,
        accent: `${h} 40% ${Math.min(bgLightness + 12, 35)}%`,
        accentForeground: `0 0% 100%`,
        border: `${h} 30% ${Math.min(bgLightness + 10, 30)}%`,
        ring: primaryHsl,
      };
    }

    return {
      background: explicitSidebarBg,
      foreground: `${h} 40% 15%`,
      primary: primaryHsl,
      primaryForeground: `0 0% 100%`,
      accent: `${h} 35% ${Math.max(bgLightness - 8, 80)}%`,
      accentForeground: `${h} 40% 18%`,
      border: `${h} 25% ${Math.max(bgLightness - 12, 75)}%`,
      ring: primaryHsl,
    };
  }

  // Sin fondo explícito: derivar todo del modo claro/oscuro global
  if (isDark) {
    return {
      background: `${h} 30% 7%`,
      foreground: `${h} 20% 95%`,
      primary: primaryHsl,
      primaryForeground: `0 0% 100%`,
      accent: `${h} 25% 14%`,
      accentForeground: `${h} 20% 95%`,
      border: `${h} 25% 18%`,
      ring: primaryHsl,
    };
  }

  return {
    background: `${h} 25% 97%`,
    foreground: `${h} 30% 15%`,
    primary: primaryHsl,
    primaryForeground: `0 0% 100%`,
    accent: `${h} 35% 92%`,
    accentForeground: `${h} 40% 18%`,
    border: `${h} 25% 88%`,
    ring: primaryHsl,
  };
}


const SIDEBAR_VARS = [
  '--sidebar-background',
  '--sidebar-foreground',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--sidebar-accent',
  '--sidebar-accent-foreground',
  '--sidebar-border',
  '--sidebar-ring',
] as const;

export function TenantProvider({ children }: TenantProviderProps) {
  const { tenant, branding, isLoading } = useTenant();
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  // Observar cambios de modo claro/oscuro en <html>
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Aplicar branding (colores generales + paleta derivada del sidebar)
  useEffect(() => {
    if (!branding) return;

    const root = document.documentElement;

    // Colores base
    if (branding.color_primario) {
      root.style.setProperty('--primary', hexToHsl(branding.color_primario));
    }
    if (branding.color_primario_foreground) {
      root.style.setProperty('--primary-foreground', hexToHsl(branding.color_primario_foreground));
    }
    if (branding.color_acento) {
      root.style.setProperty('--accent', hexToHsl(branding.color_acento));
    }

    // Paleta del sidebar derivada del primario + modo actual
    if (branding.color_primario) {
      const primaryHsl = hexToHsl(branding.color_primario);
      const explicitSidebarBg = branding.color_sidebar ? hexToHsl(branding.color_sidebar) : undefined;
      const palette = buildSidebarPalette(primaryHsl, isDark, explicitSidebarBg);

      root.style.setProperty('--sidebar-background', palette.background);
      root.style.setProperty('--sidebar-foreground', palette.foreground);
      root.style.setProperty('--sidebar-primary', palette.primary);
      root.style.setProperty('--sidebar-primary-foreground', palette.primaryForeground);
      root.style.setProperty('--sidebar-accent', palette.accent);
      root.style.setProperty('--sidebar-accent-foreground', palette.accentForeground);
      root.style.setProperty('--sidebar-border', palette.border);
      root.style.setProperty('--sidebar-ring', palette.ring);
    } else if (branding.color_sidebar) {
      // Sin color primario pero con sidebar custom
      root.style.setProperty('--sidebar-background', hexToHsl(branding.color_sidebar));
    }

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

    // Custom CSS
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
      root.style.removeProperty('--primary');
      root.style.removeProperty('--primary-foreground');
      root.style.removeProperty('--accent');
      SIDEBAR_VARS.forEach((v) => root.style.removeProperty(v));
      const customStyle = document.getElementById('tenant-custom-css');
      if (customStyle) customStyle.remove();
    };
  }, [branding, isDark]);

  return (
    <TenantContext.Provider value={{ tenant, branding, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}
