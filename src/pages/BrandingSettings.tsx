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
import { Loader2, Palette, Image, Type, Globe, Save, Eye } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
}

const defaultBranding: BrandingFormData = {
  nombre_app: 'LogiTrack',
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
};

export default function BrandingSettings() {
  const { profile, isAdmin } = useAuth();
  const tenantId = (profile as { tenant_id?: string })?.tenant_id;
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<BrandingFormData>(defaultBranding);
  const [previewMode, setPreviewMode] = useState(false);

  const { data: branding, isLoading } = useQuery({
    queryKey: ['tenant-branding-admin', tenantId],
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

  if (!isAdmin()) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground">No tienes permisos para acceder a esta página</p>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
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
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Guardar Cambios
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Tabs defaultValue="general" className="space-y-4">
              <TabsList>
                <TabsTrigger value="general">
                  <Type className="h-4 w-4 mr-2" />
                  General
                </TabsTrigger>
                <TabsTrigger value="colors">
                  <Palette className="h-4 w-4 mr-2" />
                  Colores
                </TabsTrigger>
                <TabsTrigger value="images">
                  <Image className="h-4 w-4 mr-2" />
                  Imágenes
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
                        placeholder="LogiTrack"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Título Meta (SEO)</Label>
                      <Input
                        value={formData.meta_title}
                        onChange={(e) => handleChange('meta_title', e.target.value)}
                        placeholder="LogiTrack - Sistema de Gestión Logística"
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
                    <CardDescription>URLs de logos y favicon</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Logo (Modo Claro)</Label>
                      <Input
                        value={formData.logo_light}
                        onChange={(e) => handleChange('logo_light', e.target.value)}
                        placeholder="https://..."
                      />
                      {formData.logo_light && (
                        <div className="p-4 bg-white rounded border">
                          <img src={formData.logo_light} alt="Logo Light" className="h-12 object-contain" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Logo (Modo Oscuro)</Label>
                      <Input
                        value={formData.logo_dark}
                        onChange={(e) => handleChange('logo_dark', e.target.value)}
                        placeholder="https://..."
                      />
                      {formData.logo_dark && (
                        <div className="p-4 bg-gray-900 rounded border">
                          <img src={formData.logo_dark} alt="Logo Dark" className="h-12 object-contain" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Favicon</Label>
                      <Input
                        value={formData.favicon}
                        onChange={(e) => handleChange('favicon', e.target.value)}
                        placeholder="https://..."
                      />
                      {formData.favicon && (
                        <div className="flex items-center gap-2">
                          <img src={formData.favicon} alt="Favicon" className="h-8 w-8 object-contain" />
                          <span className="text-sm text-muted-foreground">Vista previa del favicon</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
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
      </div>
    </DashboardLayout>
  );
}
