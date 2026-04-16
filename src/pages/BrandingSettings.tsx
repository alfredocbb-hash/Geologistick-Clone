import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Palette, Image, Type, Globe, Save, Eye, Phone, Building2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogoUploader } from '@/components/branding/LogoUploader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BrandingFormData {
  nombre_app: string;
  logo_light: string;
  logo_dark: string;
  favicon: string;
  color_primario: string;
  color_primario_foreground: string;
  color_secundario: string;
  color_acento: string;
  color_fondo: string;
  color_fondo_dark: string;
  color_sidebar: string;
  color_sidebar_dark: string;
  custom_css: string;
  footer_text: string;
  support_email: string;
  support_phone: string;
  custom_domain: string;
  meta_title: string;
  meta_description: string;
  // Contact & Social Media
  company_address: string;
  company_city: string;
  company_country: string;
  company_description: string;
  social_twitter: string;
  social_linkedin: string;
  social_instagram: string;
  social_facebook: string;
  social_whatsapp: string;
}

const defaultBranding: BrandingFormData = {
  nombre_app: 'Geologistick',
  logo_light: '',
  logo_dark: '',
  favicon: '',
  color_primario: '#3B82F6',
  color_primario_foreground: '#FFFFFF',
  color_secundario: '#1E40AF',
  color_acento: '#10B981',
  color_fondo: '#FFFFFF',
  color_fondo_dark: '#09090B',
  color_sidebar: '#F8FAFC',
  color_sidebar_dark: '#1A1A2E',
  custom_css: '',
  footer_text: '',
  support_email: '',
  support_phone: '',
  custom_domain: '',
  meta_title: '',
  meta_description: '',
  company_address: '',
  company_city: '',
  company_country: '',
  company_description: '',
  social_twitter: '',
  social_linkedin: '',
  social_instagram: '',
  social_facebook: '',
  social_whatsapp: '',
};

export default function BrandingSettings() {
  const { profile, isAdmin, isSuperAdmin } = useAuth();
  const userTenantId = (profile as { tenant_id?: string })?.tenant_id;
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<BrandingFormData>(defaultBranding);
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  // Fetch all tenants for Super Admin selector
  const { data: tenants } = useQuery({
    queryKey: ['tenants-list-branding'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin(),
  });

  // Use selected tenant for super admin, or user's tenant for regular users
  const tenantId = isSuperAdmin() ? selectedTenantId : userTenantId;

  const { data: branding, isLoading } = useQuery({
    queryKey: ['tenant-branding-admin', tenantId],
    refetchOnMount: true,
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from('tenant_branding')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setFormData({
          nombre_app: data.nombre_app || defaultBranding.nombre_app,
          logo_light: data.logo_light || '',
          logo_dark: data.logo_dark || '',
          favicon: data.favicon || '',
          color_primario: data.color_primario || defaultBranding.color_primario,
          color_primario_foreground: data.color_primario_foreground || defaultBranding.color_primario_foreground,
          color_secundario: data.color_secundario || defaultBranding.color_secundario,
          color_acento: data.color_acento || defaultBranding.color_acento,
          color_fondo: data.color_fondo || defaultBranding.color_fondo,
          color_fondo_dark: data.color_fondo_dark || defaultBranding.color_fondo_dark,
          color_sidebar: data.color_sidebar || defaultBranding.color_sidebar,
          color_sidebar_dark: data.color_sidebar_dark || defaultBranding.color_sidebar_dark,
          custom_css: data.custom_css || '',
          footer_text: data.footer_text || '',
          support_email: data.support_email || '',
          support_phone: data.support_phone || '',
          custom_domain: data.custom_domain || '',
          meta_title: data.meta_title || '',
          meta_description: data.meta_description || '',
          company_address: data.company_address || '',
          company_city: data.company_city || '',
          company_country: data.company_country || '',
          company_description: data.company_description || '',
          social_twitter: data.social_twitter || '',
          social_linkedin: data.social_linkedin || '',
          social_instagram: data.social_instagram || '',
          social_facebook: data.social_facebook || '',
          social_whatsapp: data.social_whatsapp || '',
        });
      }
      return data;
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: BrandingFormData) => {
      if (!tenantId) throw new Error('No tenant found');

      const payload = {
        tenant_id: tenantId,
        ...data,
      };

      if (branding) {
        const { error } = await supabase
          .from('tenant_branding')
          .update(payload)
          .eq('tenant_id', tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_branding')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      // Invalidar la consulta de esta página
      queryClient.invalidateQueries({ queryKey: ['tenant-branding-admin'] });
      // Invalidar la consulta del TenantProvider (para aplicar colores globalmente)
      queryClient.invalidateQueries({ queryKey: ['tenant-branding'] });
      toast.success('Configuración de marca guardada');
    },
    onError: (error) => {
      toast.error('Error al guardar: ' + error.message);
    },
  });

  const handleChange = (field: keyof BrandingFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  if (!isSuperAdmin()) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No tienes permisos para acceder a esta página</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Personalización de Marca</h1>
            <p className="text-muted-foreground">Configura la apariencia visual de tu plataforma</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPreviewMode(!previewMode)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {previewMode ? 'Ocultar' : 'Ver'} Preview
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending || !tenantId}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Guardar Cambios
            </Button>
          </div>
        </div>

        {/* Tenant Selector for Super Admin */}
        {isSuperAdmin() && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Seleccionar Empresa
              </CardTitle>
              <CardDescription>
                Elige la empresa cuyo branding deseas personalizar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedTenantId || ''}
                onValueChange={(value) => {
                  setSelectedTenantId(value);
                  setFormData(defaultBranding); // Reset form when changing tenant
                }}
              >
                <SelectTrigger className="w-full md:w-80">
                  <SelectValue placeholder="Selecciona una empresa..." />
                </SelectTrigger>
                <SelectContent>
                  {tenants?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Show message if no tenant selected for super admin */}
        {isSuperAdmin() && !selectedTenantId && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Selecciona una empresa para personalizar su branding</p>
            </CardContent>
          </Card>
        )}

        {/* Main content - only show when tenant is selected */}
        {tenantId && (

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Tabs defaultValue={isSuperAdmin() ? "general" : "colors"} className="space-y-4">
              <TabsList>
                {isSuperAdmin() && (
                  <TabsTrigger value="general">
                    <Type className="h-4 w-4 mr-2" />
                    General
                  </TabsTrigger>
                )}
                <TabsTrigger value="colors">
                  <Palette className="h-4 w-4 mr-2" />
                  Colores
                </TabsTrigger>
                <TabsTrigger value="images">
                  <Image className="h-4 w-4 mr-2" />
                  Imágenes
                </TabsTrigger>
                <TabsTrigger value="contact">
                  <Phone className="h-4 w-4 mr-2" />
                  Contacto
                </TabsTrigger>
                <TabsTrigger value="advanced">
                  <Globe className="h-4 w-4 mr-2" />
                  Avanzado
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general">
                <Card>
                  <CardHeader>
                    <CardTitle>Información General</CardTitle>
                    <CardDescription>Nombre y texto de la aplicación</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nombre de la Aplicación</Label>
                      <Input
                        value={formData.nombre_app}
                        onChange={(e) => handleChange('nombre_app', e.target.value)}
                        placeholder="Geologistick"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Título Meta (SEO)</Label>
                      <Input
                        value={formData.meta_title}
                        onChange={(e) => handleChange('meta_title', e.target.value)}
                        placeholder="Geologistick - Sistema de Gestión Logística"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descripción Meta (SEO)</Label>
                      <Textarea
                        value={formData.meta_description}
                        onChange={(e) => handleChange('meta_description', e.target.value)}
                        placeholder="Plataforma integral para gestión de envíos y logística"
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Texto del Footer</Label>
                      <Input
                        value={formData.footer_text}
                        onChange={(e) => handleChange('footer_text', e.target.value)}
                        placeholder="© 2025 Tu Empresa. Todos los derechos reservados."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Email de Soporte</Label>
                        <Input
                          type="email"
                          value={formData.support_email}
                          onChange={(e) => handleChange('support_email', e.target.value)}
                          placeholder="soporte@tuempresa.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Teléfono de Soporte</Label>
                        <Input
                          value={formData.support_phone}
                          onChange={(e) => handleChange('support_phone', e.target.value)}
                          placeholder="+54 11 1234-5678"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="colors">
                <Card>
                  <CardHeader>
                    <CardTitle>Paleta de Colores</CardTitle>
                    <CardDescription>Personaliza los colores de la interfaz</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Color Primario</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={formData.color_primario}
                            onChange={(e) => handleChange('color_primario', e.target.value)}
                            className="w-16 h-10 p-1"
                          />
                          <Input
                            value={formData.color_primario}
                            onChange={(e) => handleChange('color_primario', e.target.value)}
                            placeholder="#3B82F6"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Texto sobre Primario</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={formData.color_primario_foreground}
                            onChange={(e) => handleChange('color_primario_foreground', e.target.value)}
                            className="w-16 h-10 p-1"
                          />
                          <Input
                            value={formData.color_primario_foreground}
                            onChange={(e) => handleChange('color_primario_foreground', e.target.value)}
                            placeholder="#FFFFFF"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Color Secundario</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={formData.color_secundario}
                            onChange={(e) => handleChange('color_secundario', e.target.value)}
                            className="w-16 h-10 p-1"
                          />
                          <Input
                            value={formData.color_secundario}
                            onChange={(e) => handleChange('color_secundario', e.target.value)}
                            placeholder="#1E40AF"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Color de Acento</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={formData.color_acento}
                            onChange={(e) => handleChange('color_acento', e.target.value)}
                            className="w-16 h-10 p-1"
                          />
                          <Input
                            value={formData.color_acento}
                            onChange={(e) => handleChange('color_acento', e.target.value)}
                            placeholder="#10B981"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Color Sidebar (Claro)</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={formData.color_sidebar}
                            onChange={(e) => handleChange('color_sidebar', e.target.value)}
                            className="w-16 h-10 p-1"
                          />
                          <Input
                            value={formData.color_sidebar}
                            onChange={(e) => handleChange('color_sidebar', e.target.value)}
                            placeholder="#F8FAFC"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Color Sidebar (Oscuro)</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={formData.color_sidebar_dark}
                            onChange={(e) => handleChange('color_sidebar_dark', e.target.value)}
                            className="w-16 h-10 p-1"
                          />
                          <Input
                            value={formData.color_sidebar_dark}
                            onChange={(e) => handleChange('color_sidebar_dark', e.target.value)}
                            placeholder="#1A1A2E"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="images">
                <Card>
                  <CardHeader>
                    <CardTitle>Logos e Imágenes</CardTitle>
                    <CardDescription>Sube tus logos y favicon directamente o usa URLs externas</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {tenantId && (
                      <>
                        <LogoUploader
                          label="Logo (Modo Claro)"
                          value={formData.logo_light}
                          onChange={(url) => handleChange('logo_light', url)}
                          tenantId={tenantId}
                          fileType="logo-light"
                          helpText="Recomendado: PNG o SVG con fondo transparente, 200x60px mínimo"
                        />
                        
                        <LogoUploader
                          label="Logo (Modo Oscuro)"
                          value={formData.logo_dark}
                          onChange={(url) => handleChange('logo_dark', url)}
                          tenantId={tenantId}
                          fileType="logo-dark"
                          helpText="Versión clara del logo para fondos oscuros"
                        />
                        
                        <LogoUploader
                          label="Favicon"
                          value={formData.favicon}
                          onChange={(url) => handleChange('favicon', url)}
                          tenantId={tenantId}
                          fileType="favicon"
                          accept="image/png,image/x-icon,image/svg+xml"
                          helpText="Icono para pestaña del navegador. Recomendado: 32x32px o 64x64px"
                        />
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="contact">
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Ubicación</CardTitle>
                      <CardDescription>Dirección física de la empresa</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Dirección</Label>
                        <Input
                          value={formData.company_address}
                          onChange={(e) => handleChange('company_address', e.target.value)}
                          placeholder="Av. Corrientes 1234, Piso 5"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Ciudad</Label>
                          <Input
                            value={formData.company_city}
                            onChange={(e) => handleChange('company_city', e.target.value)}
                            placeholder="Buenos Aires"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>País</Label>
                          <Input
                            value={formData.company_country}
                            onChange={(e) => handleChange('company_country', e.target.value)}
                            placeholder="Argentina"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Descripción de la Empresa</Label>
                        <Textarea
                          value={formData.company_description}
                          onChange={(e) => handleChange('company_description', e.target.value)}
                          placeholder="Plataforma líder en gestión de logística y envíos..."
                          rows={3}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Redes Sociales</CardTitle>
                      <CardDescription>Links a tus perfiles de redes sociales</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Twitter / X</Label>
                          <Input
                            value={formData.social_twitter}
                            onChange={(e) => handleChange('social_twitter', e.target.value)}
                            placeholder="https://twitter.com/tuempresa"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>LinkedIn</Label>
                          <Input
                            value={formData.social_linkedin}
                            onChange={(e) => handleChange('social_linkedin', e.target.value)}
                            placeholder="https://linkedin.com/company/tuempresa"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Instagram</Label>
                          <Input
                            value={formData.social_instagram}
                            onChange={(e) => handleChange('social_instagram', e.target.value)}
                            placeholder="https://instagram.com/tuempresa"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Facebook</Label>
                          <Input
                            value={formData.social_facebook}
                            onChange={(e) => handleChange('social_facebook', e.target.value)}
                            placeholder="https://facebook.com/tuempresa"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>WhatsApp</Label>
                        <Input
                          value={formData.social_whatsapp}
                          onChange={(e) => handleChange('social_whatsapp', e.target.value)}
                          placeholder="+54 11 1234-5678"
                        />
                        <p className="text-xs text-muted-foreground">
                          Número de WhatsApp para contacto directo
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="advanced">
                <Card>
                  <CardHeader>
                    <CardTitle>Configuración Avanzada</CardTitle>
                    <CardDescription>Dominio personalizado y CSS custom</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Dominio Personalizado</Label>
                      <Input
                        value={formData.custom_domain}
                        onChange={(e) => handleChange('custom_domain', e.target.value)}
                        placeholder="app.tuempresa.com"
                      />
                      <p className="text-xs text-muted-foreground">
                        Contacta soporte para configurar tu dominio personalizado
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>CSS Personalizado</Label>
                      <Textarea
                        value={formData.custom_css}
                        onChange={(e) => handleChange('custom_css', e.target.value)}
                        placeholder={`/* Estilos CSS personalizados */
.custom-class {
  /* tus estilos aquí */
}`}
                        rows={10}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Agrega CSS personalizado para ajustar la apariencia
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Preview Panel */}
          {previewMode && (
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle className="text-sm">Vista Previa</CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    className="rounded-lg border overflow-hidden"
                    style={{ backgroundColor: formData.color_fondo }}
                  >
                    {/* Mini sidebar preview */}
                    <div className="flex">
                      <div 
                        className="w-12 h-40 p-2"
                        style={{ backgroundColor: formData.color_sidebar }}
                      >
                        <div 
                          className="w-8 h-8 rounded"
                          style={{ backgroundColor: formData.color_primario }}
                        />
                      </div>
                      <div className="flex-1 p-3">
                        <div 
                          className="text-sm font-bold mb-2"
                          style={{ color: formData.color_primario }}
                        >
                          {formData.nombre_app}
                        </div>
                        <div 
                          className="px-3 py-1.5 rounded text-xs mb-2 inline-block"
                          style={{ 
                            backgroundColor: formData.color_primario,
                            color: formData.color_primario_foreground 
                          }}
                        >
                          Botón Primario
                        </div>
                        <div 
                          className="px-3 py-1.5 rounded text-xs inline-block ml-1"
                          style={{ 
                            backgroundColor: formData.color_acento,
                            color: '#fff' 
                          }}
                        >
                          Acento
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        )}
      </div>
    
  );
}
