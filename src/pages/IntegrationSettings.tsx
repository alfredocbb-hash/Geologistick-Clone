import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  CreditCard, 
  MapPin, 
  MessageSquare, 
  Mail, 
  Phone, 
  Eye, 
  EyeOff, 
  Save, 
  CheckCircle, 
  XCircle,
  Loader2,
  Copy,
  ExternalLink,
  FileText,
  Store
} from 'lucide-react';

type IntegrationType = 'mercado_pago' | 'google_maps' | 'whatsapp' | 'email_smtp' | 'sms' | 'arca' | 'tiendanube';
type IntegrationEnvironment = 'sandbox' | 'production';

interface IntegrationConfig {
  id?: string;
  integration_type: IntegrationType;
  config_key: string;
  config_value: string;
  is_active: boolean;
  environment: IntegrationEnvironment;
}

interface IntegrationField {
  key: string;
  label: string;
  placeholder: string;
  type: 'text' | 'password';
  required: boolean;
  helpText?: string;
}

const INTEGRATIONS_CONFIG: Record<IntegrationType, {
  name: string;
  description: string;
  icon: React.ElementType;
  fields: IntegrationField[];
  webhookUrl?: string;
  docsUrl?: string;
}> = {
  mercado_pago: {
    name: 'Mercado Pago',
    description: 'Integración con Mercado Pago para procesar pagos online',
    icon: CreditCard,
    docsUrl: 'https://www.mercadopago.com.ar/developers/es/docs',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'APP_USR-...', type: 'password', required: true, helpText: 'Token de acceso de tu aplicación de Mercado Pago' },
      { key: 'public_key', label: 'Public Key', placeholder: 'APP_USR-...', type: 'text', required: true, helpText: 'Clave pública de tu aplicación' },
      { key: 'webhook_secret', label: 'Webhook Secret', placeholder: 'Secret para validar webhooks', type: 'password', required: false, helpText: 'Opcional: para validar webhooks' },
    ],
    webhookUrl: '/functions/v1/mercadopago-webhook',
  },
  google_maps: {
    name: 'Google Maps',
    description: 'API de Google Maps para geocodificación y mapas',
    icon: MapPin,
    docsUrl: 'https://developers.google.com/maps/documentation',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'AIza...', type: 'password', required: true, helpText: 'API Key de Google Cloud Platform' },
    ],
  },
  whatsapp: {
    name: 'WhatsApp Business',
    description: 'Envío de notificaciones por WhatsApp',
    icon: MessageSquare,
    docsUrl: 'https://developers.facebook.com/docs/whatsapp',
    fields: [
      { key: 'api_url', label: 'API URL', placeholder: 'https://graph.facebook.com/v17.0', type: 'text', required: true },
      { key: 'api_token', label: 'API Token', placeholder: 'Token de acceso', type: 'password', required: true },
      { key: 'phone_number_id', label: 'Phone Number ID', placeholder: 'ID del número de teléfono', type: 'text', required: true },
    ],
  },
  email_smtp: {
    name: 'Email SMTP',
    description: 'Configuración de servidor SMTP para envío de emails',
    icon: Mail,
    fields: [
      { key: 'host', label: 'Host SMTP', placeholder: 'smtp.gmail.com', type: 'text', required: true },
      { key: 'port', label: 'Puerto', placeholder: '587', type: 'text', required: true },
      { key: 'user', label: 'Usuario', placeholder: 'email@ejemplo.com', type: 'text', required: true },
      { key: 'password', label: 'Contraseña', placeholder: '********', type: 'password', required: true },
      { key: 'from_email', label: 'Email Remitente', placeholder: 'no-reply@miempresa.com', type: 'text', required: true },
      { key: 'from_name', label: 'Nombre Remitente', placeholder: 'Mi Empresa', type: 'text', required: false },
    ],
  },
  sms: {
    name: 'SMS',
    description: 'Envío de notificaciones por SMS',
    icon: Phone,
    fields: [
      { key: 'provider', label: 'Proveedor', placeholder: 'twilio', type: 'text', required: true },
      { key: 'api_key', label: 'API Key', placeholder: 'Tu API Key', type: 'password', required: true },
      { key: 'api_secret', label: 'API Secret', placeholder: 'Tu API Secret', type: 'password', required: true },
      { key: 'sender_id', label: 'Sender ID', placeholder: '+5491112345678', type: 'text', required: true },
    ],
  },
  arca: {
    name: 'ARCA (AFIP)',
    description: 'Facturación electrónica con AFIP/ARCA',
    icon: FileText,
    docsUrl: 'https://www.afip.gob.ar/fe/',
    fields: [
      { key: 'cuit', label: 'CUIT del Contribuyente', placeholder: '20-12345678-9', type: 'text', required: true, helpText: 'CUIT de la empresa emisora de facturas' },
      { key: 'punto_venta', label: 'Punto de Venta', placeholder: '1', type: 'text', required: true, helpText: 'Número de punto de venta electrónico habilitado en AFIP' },
      { key: 'cert_pem', label: 'Certificado X.509 (PEM)', placeholder: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----', type: 'password', required: true, helpText: 'Certificado digital emitido por AFIP en formato PEM' },
      { key: 'private_key', label: 'Clave Privada (PEM)', placeholder: '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----', type: 'password', required: true, helpText: 'Clave privada correspondiente al certificado' },
    ],
  },
  tiendanube: {
    name: 'Tiendanube',
    description: 'Sincronización de pedidos con Tiendanube',
    icon: Store,
    docsUrl: 'https://tiendanube.github.io/api-documentation',
    webhookUrl: '/functions/v1/tiendanube-webhook',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'Tu Client ID de Tiendanube', type: 'text', required: true, helpText: 'ID de la aplicación creada en Tiendanube Partners' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'Tu Client Secret', type: 'password', required: true, helpText: 'Secret de la aplicación de Tiendanube' },
    ],
  },
};

export default function IntegrationSettings() {
  const [activeTab, setActiveTab] = useState<IntegrationType>('mercado_pago');
  const [environment, setEnvironment] = useState<IntegrationEnvironment>('sandbox');
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isActive, setIsActive] = useState(true);
  const queryClient = useQueryClient();
  const { tenantId, isLoading: tenantLoading } = useTenant();

  // Fetch all configurations for current integration type and environment (filtered by tenant)
  const { data: configs, isLoading } = useQuery({
    queryKey: ['integration-configs', activeTab, environment, tenantId],
    queryFn: async () => {
      if (!tenantId) return {};
      
      const { data, error } = await supabase
        .from('system_integrations')
        .select('*')
        .eq('integration_type', activeTab as any)
        .eq('environment', environment)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      
      // Convert to a map for easy access
      const configMap: Record<string, IntegrationConfig> = {};
      data?.forEach((config: IntegrationConfig) => {
        configMap[config.config_key] = config;
      });
      
      // Populate form data
      const newFormData: Record<string, string> = {};
      data?.forEach((config: IntegrationConfig) => {
        newFormData[config.config_key] = config.config_value;
      });
      setFormData(newFormData);
      
      // Set active status (use first config's is_active or default to true)
      if (data && data.length > 0) {
        setIsActive(data[0].is_active);
      } else {
        setIsActive(true);
      }
      
      return configMap;
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) {
        throw new Error('No se encontró tu empresa. Por favor, cierra sesión y vuelve a entrar.');
      }
      
      const integrationConfig = INTEGRATIONS_CONFIG[activeTab];
      
      // Upsert each field
      for (const field of integrationConfig.fields) {
        const value = formData[field.key] || '';
        
        if (field.required && !value) {
          throw new Error(`El campo ${field.label} es requerido`);
        }
        
        if (value) {
          // Check if record exists for this tenant
          const { data: existing } = await supabase
            .from('system_integrations')
            .select('id')
            .eq('integration_type', activeTab as any)
            .eq('config_key', field.key)
            .eq('environment', environment)
            .eq('tenant_id', tenantId)
            .maybeSingle();
          
          if (existing) {
            // Update existing record
            const { error } = await supabase
              .from('system_integrations')
              .update({
                config_value: value,
                is_active: isActive,
              })
              .eq('id', existing.id);
              
            if (error) throw error;
          } else {
            // Insert new record with explicit tenant_id
            const { error } = await supabase
              .from('system_integrations')
              .insert({
                integration_type: activeTab as any,
                config_key: field.key,
                config_value: value,
                is_active: isActive,
                environment: environment,
                tenant_id: tenantId,
              } as any);

            if (error) throw error;
          }
        }
      }
    },
    onSuccess: () => {
      toast.success('Configuración guardada correctamente');
      queryClient.invalidateQueries({ queryKey: ['integration-configs'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al guardar la configuración');
    },
  });

  const toggleSecretVisibility = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleInputChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const copyWebhookUrl = () => {
    const config = INTEGRATIONS_CONFIG[activeTab];
    if (config.webhookUrl) {
      const fullUrl = `${import.meta.env.VITE_SUPABASE_URL}${config.webhookUrl}`;
      navigator.clipboard.writeText(fullUrl);
      toast.success('URL copiada al portapapeles');
    }
  };

  const isConfigured = (type: IntegrationType) => {
    if (!configs) return false;
    const integrationConfig = INTEGRATIONS_CONFIG[type];
    const requiredFields = integrationConfig.fields.filter(f => f.required);
    return requiredFields.every(f => configs[f.key]?.config_value);
  };

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuración de Integraciones</h1>
          <p className="text-muted-foreground text-destructive">
            No se encontró tu empresa. Por favor, cierra sesión y vuelve a entrar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración de Integraciones</h1>
        <p className="text-muted-foreground">
          Configura las API keys y credenciales de servicios externos
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as IntegrationType)}>
        <TabsList className="grid w-full grid-cols-7">
          {(Object.entries(INTEGRATIONS_CONFIG) as [IntegrationType, typeof INTEGRATIONS_CONFIG[IntegrationType]][]).map(([key, config]) => {
            const Icon = config.icon;
            const configured = configs && Object.keys(configs).length > 0;
            return (
              <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{config.name}</span>
                {configured && (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {(Object.entries(INTEGRATIONS_CONFIG) as [IntegrationType, typeof INTEGRATIONS_CONFIG[IntegrationType]][]).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <TabsContent key={key} value={key}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle>{config.name}</CardTitle>
                        <CardDescription>{config.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="is-active" className="text-sm">
                          {isActive ? 'Activo' : 'Inactivo'}
                        </Label>
                        <Switch
                          id="is-active"
                          checked={isActive}
                          onCheckedChange={setIsActive}
                        />
                      </div>
                      {isActive ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Inactivo
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Environment Toggle */}
                  <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                    <Label className="font-medium">Entorno:</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={environment === 'sandbox' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setEnvironment('sandbox')}
                      >
                        🧪 Sandbox
                      </Button>
                      <Button
                        variant={environment === 'production' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setEnvironment('production')}
                      >
                        🚀 Production
                      </Button>
                    </div>
                    {environment === 'production' && (
                      <Badge variant="destructive">Producción - ¡Cuidado!</Badge>
                    )}
                  </div>

                  {/* Configuration Fields */}
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {config.fields.map((field) => (
                        <div key={field.key} className="space-y-2">
                          <Label htmlFor={field.key} className="flex items-center gap-2">
                            {field.label}
                            {field.required && <span className="text-destructive">*</span>}
                          </Label>
                          <div className="relative">
                            <Input
                              id={field.key}
                              type={field.type === 'password' && !showSecrets[field.key] ? 'password' : 'text'}
                              placeholder={field.placeholder}
                              value={formData[field.key] || ''}
                              onChange={(e) => handleInputChange(field.key, e.target.value)}
                              className="pr-10"
                            />
                            {field.type === 'password' && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                                onClick={() => toggleSecretVisibility(field.key)}
                              >
                                {showSecrets[field.key] ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                          {field.helpText && (
                            <p className="text-xs text-muted-foreground">{field.helpText}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Webhook URL */}
                  {config.webhookUrl && (
                    <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                      <Label className="font-medium">URL para Webhooks:</Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-background rounded border text-sm font-mono truncate">
                          {import.meta.env.VITE_SUPABASE_URL}{config.webhookUrl}
                        </code>
                        <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Configura esta URL en el panel de {config.name} para recibir notificaciones
                      </p>
                    </div>
                  )}

                  {/* Documentation Link */}
                  {config.docsUrl && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ExternalLink className="h-4 w-4" />
                      <a 
                        href={config.docsUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:underline hover:text-primary"
                      >
                        Ver documentación de {config.name}
                      </a>
                    </div>
                  )}

                  {/* Save Button */}
                  <div className="flex justify-end pt-4 border-t">
                    <Button 
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Guardar Configuración
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
