import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

type IntegrationType = 'mercado_pago' | 'google_maps' | 'whatsapp' | 'email_smtp' | 'sms';
type IntegrationEnvironment = 'sandbox' | 'production';

interface IntegrationStatus {
  isConfigured: boolean;
  isActive: boolean;
  environment: IntegrationEnvironment;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to check if an integration is configured and active for the current tenant
 * Used in UI to show/hide or enable/disable integration features
 */
export function useIntegrationConfig(
  integrationType: IntegrationType,
  preferredEnvironment: IntegrationEnvironment = 'production'
): IntegrationStatus {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['integration-status', integrationType, preferredEnvironment, tenantId],
    queryFn: async () => {
      if (!tenantId) {
        return {
          isConfigured: false,
          isActive: false,
          environment: preferredEnvironment,
        };
      }
      
      // First try preferred environment, then fallback to the other
      const environments: IntegrationEnvironment[] = 
        preferredEnvironment === 'production' 
          ? ['production', 'sandbox'] 
          : ['sandbox', 'production'];

      for (const env of environments) {
        const { data, error } = await supabase
          .from('system_integrations')
          .select('*')
          .eq('integration_type', integrationType)
          .eq('environment', env)
          .eq('is_active', true)
          .eq('tenant_id', tenantId);

        if (error) throw error;

        if (data && data.length > 0) {
          // Check if at least one required field is configured
          // (for now, just check if any config exists)
          return {
            isConfigured: true,
            isActive: true,
            environment: env,
          };
        }
      }

      return {
        isConfigured: false,
        isActive: false,
        environment: preferredEnvironment,
      };
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    enabled: !tenantLoading,
  });

  return {
    isConfigured: data?.isConfigured ?? false,
    isActive: data?.isActive ?? false,
    environment: data?.environment ?? preferredEnvironment,
    isLoading: isLoading || tenantLoading,
    error: error as Error | null,
  };
}

/**
 * Check if Mercado Pago is configured
 */
export function useMercadoPagoConfig() {
  return useIntegrationConfig('mercado_pago');
}

/**
 * Check if Google Maps is configured
 */
export function useGoogleMapsConfig() {
  return useIntegrationConfig('google_maps');
}

/**
 * Check if WhatsApp is configured
 */
export function useWhatsAppConfig() {
  return useIntegrationConfig('whatsapp');
}

/**
 * Check if Email SMTP is configured
 */
export function useEmailConfig() {
  return useIntegrationConfig('email_smtp');
}

/**
 * Check if SMS is configured
 */
export function useSmsConfig() {
  return useIntegrationConfig('sms');
}
