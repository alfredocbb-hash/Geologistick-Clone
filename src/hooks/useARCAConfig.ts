import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ARCAConfigStatus {
  isConfigured: boolean;
  isActive: boolean;
  environment: 'sandbox' | 'production';
  hasBothEnvironments: boolean;
  config: ARCAContributorConfig | null;
  isLoading: boolean;
  error: Error | null;
}

interface ARCAContributorConfig {
  id: string;
  cuit: string;
  razon_social: string;
  condicion_iva: string;
  punto_venta: number;
  factura_a_habilitada: boolean;
  factura_b_habilitada: boolean;
  factura_c_habilitada: boolean;
  environment: 'sandbox' | 'production';
}

/**
 * Hook to check if ARCA integration is configured.
 * Returns status for each environment independently.
 */
export function useARCAIntegration(preferredEnvironment: 'sandbox' | 'production' = 'production'): ARCAConfigStatus {
  const { data, isLoading, error } = useQuery({
    queryKey: ['arca-integration-status'],
    queryFn: async () => {
      // Check both environments
      const [prodResult, sandboxResult] = await Promise.all([
        supabase
          .from('system_integrations')
          .select('config_key, config_value')
          .eq('integration_type', 'arca')
          .eq('environment', 'production')
          .eq('is_active', true),
        supabase
          .from('system_integrations')
          .select('config_key, config_value')
          .eq('integration_type', 'arca')
          .eq('environment', 'sandbox')
          .eq('is_active', true),
      ]);

      const isEnvConfigured = (configs: typeof prodResult['data']) => {
        if (!configs || configs.length === 0) return false;
        const configMap: Record<string, string> = {};
        configs.forEach((c) => { configMap[c.config_key] = c.config_value; });
        return !!(configMap.cuit && configMap.cert_pem && configMap.private_key && configMap.punto_venta);
      };

      const hasProd = isEnvConfigured(prodResult.data);
      const hasSandbox = isEnvConfigured(sandboxResult.data);

      return { hasProd, hasSandbox };
    },
    staleTime: 1000 * 60 * 5,
  });

  // Also get the contributor config if it exists
  const { data: contributorConfig } = useQuery({
    queryKey: ['arca-contributor-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arca_config')
        .select('*')
        .eq('is_active', true)
        .single();

      if (error) return null;
      return data as ARCAContributorConfig;
    },
    staleTime: 1000 * 60 * 5,
  });

  const hasProd = data?.hasProd ?? false;
  const hasSandbox = data?.hasSandbox ?? false;
  const hasBothEnvironments = hasProd && hasSandbox;

  // Determine active environment: if preferred is configured, use it; otherwise use the other
  let environment: 'sandbox' | 'production' = preferredEnvironment;
  if (preferredEnvironment === 'production' && !hasProd && hasSandbox) {
    environment = 'sandbox';
  } else if (preferredEnvironment === 'sandbox' && !hasSandbox && hasProd) {
    environment = 'production';
  }

  const isConfigured = hasProd || hasSandbox;

  return {
    isConfigured,
    isActive: isConfigured,
    environment,
    hasBothEnvironments,
    config: contributorConfig ?? null,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Determine the correct invoice type based on IVA conditions
 */
export function determinarTipoFactura(
  condicionEmisor: string, 
  condicionReceptor: string
): 'A' | 'B' | 'C' {
  // Emisor Responsable Inscripto
  if (condicionEmisor === 'responsable_inscripto') {
    if (condicionReceptor === 'responsable_inscripto') {
      return 'A';
    }
    return 'B'; // Monotributo, Exento, Consumidor Final
  }
  
  // Emisor Monotributista
  if (condicionEmisor === 'monotributo') {
    return 'C'; // Siempre Factura C
  }
  
  // Emisor Exento
  if (condicionEmisor === 'exento') {
    return 'C';
  }
  
  return 'B'; // Default
}

/**
 * Validate CUIT format (XX-XXXXXXXX-X)
 */
export function validateCUIT(cuit: string): boolean {
  // Remove dashes
  const cleanCuit = cuit.replace(/-/g, '');
  
  // Must be 11 digits
  if (!/^\d{11}$/.test(cleanCuit)) {
    return false;
  }
  
  // Validate verification digit using AFIP algorithm
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCuit[i]) * multipliers[i];
  }
  
  const remainder = sum % 11;
  const verificationDigit = remainder === 0 ? 0 : remainder === 1 ? 9 : 11 - remainder;
  
  return parseInt(cleanCuit[10]) === verificationDigit;
}

/**
 * Format CUIT with dashes (XX-XXXXXXXX-X)
 */
export function formatCUIT(cuit: string): string {
  const cleanCuit = cuit.replace(/\D/g, '');
  if (cleanCuit.length !== 11) return cuit;
  return `${cleanCuit.slice(0, 2)}-${cleanCuit.slice(2, 10)}-${cleanCuit.slice(10)}`;
}
