import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ARCAConfigStatus {
  isConfigured: boolean;
  isActive: boolean;
  environment: 'sandbox' | 'production';
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
 * Hook to check if ARCA integration is configured
 * Checks system_integrations for ARCA credentials
 */
export function useARCAIntegration(preferredEnvironment: 'sandbox' | 'production' = 'production'): ARCAConfigStatus {
  const { data, isLoading, error } = useQuery({
    queryKey: ['arca-integration-status', preferredEnvironment],
    queryFn: async () => {
      // Check environments in order of preference
      const environments: ('sandbox' | 'production')[] = 
        preferredEnvironment === 'production' 
          ? ['production', 'sandbox'] 
          : ['sandbox', 'production'];

      for (const env of environments) {
        const { data: configs, error } = await supabase
          .from('system_integrations')
          .select('config_key, config_value')
          .eq('integration_type', 'arca')
          .eq('environment', env)
          .eq('is_active', true);

        if (error) throw error;

        if (configs && configs.length > 0) {
          // Check if required fields are configured
          const configMap: Record<string, string> = {};
          configs.forEach((c) => {
            configMap[c.config_key] = c.config_value;
          });

          const hasRequiredFields = 
            configMap.cuit && 
            configMap.cert_pem && 
            configMap.private_key && 
            configMap.punto_venta;

          if (hasRequiredFields) {
            return {
              isConfigured: true,
              isActive: true,
              environment: env,
            };
          }
        }
      }

      return {
        isConfigured: false,
        isActive: false,
        environment: preferredEnvironment,
      };
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
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

  return {
    isConfigured: data?.isConfigured ?? false,
    isActive: data?.isActive ?? false,
    environment: data?.environment ?? preferredEnvironment,
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
