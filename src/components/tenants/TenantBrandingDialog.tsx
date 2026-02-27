import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoUploader } from "@/components/branding/LogoUploader";
import { toast } from "sonner";
import { Loader2, Palette, Image, Building2, Globe } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TenantBrandingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: { id: string; nombre: string };
  onSuccess?: () => void;
}

interface BrandingFormData {
  nombre_app: string;
  meta_title: string;
  meta_description: string;
  footer_text: string;
  support_email: string;
  support_phone: string;
  color_primario: string;
  color_primario_foreground: string;
  color_secundario: string;
  color_acento: string;
  color_sidebar: string;
  color_sidebar_dark: string;
  color_fondo: string;
  color_fondo_dark: string;
  logo_light: string;
  logo_dark: string;
  favicon: string;
  company_address: string;
  company_city: string;
  company_country: string;
  company_description: string;
  social_twitter: string;
  social_linkedin: string;
  social_instagram: string;
  social_facebook: string;
  social_whatsapp: string;
  custom_css: string;
  custom_domain: string;
}

const defaultBranding: BrandingFormData = {
  nombre_app: "",
  meta_title: "",
  meta_description: "",
  footer_text: "",
  support_email: "",
  support_phone: "",
  color_primario: "#3b82f6",
  color_primario_foreground: "#ffffff",
  color_secundario: "#64748b",
  color_acento: "#f59e0b",
  color_sidebar: "#f8fafc",
  color_sidebar_dark: "#1e293b",
  color_fondo: "#ffffff",
  color_fondo_dark: "#0f172a",
  logo_light: "",
  logo_dark: "",
  favicon: "",
  company_address: "",
  company_city: "",
  company_country: "",
  company_description: "",
  social_twitter: "",
  social_linkedin: "",
  social_instagram: "",
  social_facebook: "",
  social_whatsapp: "",
  custom_css: "",
  custom_domain: "",
};

export function TenantBrandingDialog({ open, onOpenChange, tenant, onSuccess }: TenantBrandingDialogProps) {
  const [formData, setFormData] = useState<BrandingFormData>(defaultBranding);
  const queryClient = useQueryClient();

  const { data: branding, isLoading } = useQuery({
    queryKey: ["tenant-branding", tenant.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenant_branding").select("*").eq("tenant_id", tenant.id).single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (branding) {
      setFormData({
        nombre_app: branding.nombre_app || tenant.nombre,
        meta_title: branding.meta_title || "",
        meta_description: branding.meta_description || "",
        footer_text: branding.footer_text || "",
        support_email: branding.support_email || "",
        support_phone: branding.support_phone || "",
        color_primario: branding.color_primario || "#3b82f6",
        color_primario_foreground: branding.color_primario_foreground || "#ffffff",
        color_secundario: branding.color_secundario || "#64748b",
        color_acento: branding.color_acento || "#f59e0b",
        color_sidebar: branding.color_sidebar || "#f8fafc",
        color_sidebar_dark: branding.color_sidebar_dark || "#1e293b",
        color_fondo: branding.color_fondo || "#ffffff",
        color_fondo_dark: branding.color_fondo_dark || "#0f172a",
        logo_light: branding.logo_light || "",
        logo_dark: branding.logo_dark || "",
        favicon: branding.favicon || "",
        company_address: branding.company_address || "",
        company_city: branding.company_city || "",
        company_country: branding.company_country || "",
        company_description: branding.company_description || "",
        social_twitter: branding.social_twitter || "",
        social_linkedin: branding.social_linkedin || "",
        social_instagram: branding.social_instagram || "",
        social_facebook: branding.social_facebook || "",
        social_whatsapp: branding.social_whatsapp || "",
        custom_css: branding.custom_css || "",
        custom_domain: branding.custom_domain || "",
      });
    } else {
      setFormData({ ...defaultBranding, nombre_app: tenant.nombre });
    }
  }, [branding, tenant.nombre]);

  const saveMutation = useMutation({
    mutationFn: async (data: BrandingFormData) => {
      const { error } = await supabase.from("tenant_branding").upsert(
        {
          tenant_id: tenant.id,
          ...data,
        },
        { onConflict: "tenant_id" },
      );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-branding", tenant.id] });
      toast.success("Branding guardado correctamente");
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("Error al guardar: " + error.message);
    },
  });

  const handleChange = (field: keyof BrandingFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Personalizar: {tenant.nombre}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(90vh-140px)]">
            <div className="px-6 pb-6">
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-4">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="colors">Colores</TabsTrigger>
                  <TabsTrigger value="images">Imágenes</TabsTrigger>
                  <TabsTrigger value="contact">Contacto</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Información General
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nombre de la Aplicación</Label>
                          <Input
                            value={formData.nombre_app}
                            onChange={(e) => handleChange("nombre_app", e.target.value)}
                            placeholder="Mi Empresa"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Título SEO</Label>
                          <Input
                            value={formData.meta_title}
                            onChange={(e) => handleChange("meta_title", e.target.value)}
                            placeholder="Título para buscadores"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Descripción SEO</Label>
                        <Textarea
                          value={formData.meta_description}
                          onChange={(e) => handleChange("meta_description", e.target.value)}
                          placeholder="Descripción para buscadores"
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Email de Soporte</Label>
                          <Input
                            type="email"
                            value={formData.support_email}
                            onChange={(e) => handleChange("support_email", e.target.value)}
                            placeholder="soporte@empresa.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Teléfono de Soporte</Label>
                          <Input
                            value={formData.support_phone}
                            onChange={(e) => handleChange("support_phone", e.target.value)}
                            placeholder="+54 11 1234-5678"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Texto del Footer</Label>
                        <Input
                          value={formData.footer_text}
                          onChange={(e) => handleChange("footer_text", e.target.value)}
                          placeholder="© 2024 Geologistick. Todos los derechos reservados."
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="colors" className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        Paleta de Colores
                      </CardTitle>
                      <CardDescription>Personaliza los colores de la interfaz</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Color Primario</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={formData.color_primario}
                              onChange={(e) => handleChange("color_primario", e.target.value)}
                              className="w-14 h-10 p-1 cursor-pointer"
                            />
                            <Input
                              value={formData.color_primario}
                              onChange={(e) => handleChange("color_primario", e.target.value)}
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Texto sobre Primario</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={formData.color_primario_foreground}
                              onChange={(e) => handleChange("color_primario_foreground", e.target.value)}
                              className="w-14 h-10 p-1 cursor-pointer"
                            />
                            <Input
                              value={formData.color_primario_foreground}
                              onChange={(e) => handleChange("color_primario_foreground", e.target.value)}
                              className="flex-1"
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
                              onChange={(e) => handleChange("color_secundario", e.target.value)}
                              className="w-14 h-10 p-1 cursor-pointer"
                            />
                            <Input
                              value={formData.color_secundario}
                              onChange={(e) => handleChange("color_secundario", e.target.value)}
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Color de Acento</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={formData.color_acento}
                              onChange={(e) => handleChange("color_acento", e.target.value)}
                              className="w-14 h-10 p-1 cursor-pointer"
                            />
                            <Input
                              value={formData.color_acento}
                              onChange={(e) => handleChange("color_acento", e.target.value)}
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Sidebar (Claro)</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={formData.color_sidebar}
                              onChange={(e) => handleChange("color_sidebar", e.target.value)}
                              className="w-14 h-10 p-1 cursor-pointer"
                            />
                            <Input
                              value={formData.color_sidebar}
                              onChange={(e) => handleChange("color_sidebar", e.target.value)}
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Sidebar (Oscuro)</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={formData.color_sidebar_dark}
                              onChange={(e) => handleChange("color_sidebar_dark", e.target.value)}
                              className="w-14 h-10 p-1 cursor-pointer"
                            />
                            <Input
                              value={formData.color_sidebar_dark}
                              onChange={(e) => handleChange("color_sidebar_dark", e.target.value)}
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Preview */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Vista Previa</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4">
                        <div
                          className="flex-1 h-24 rounded-lg flex items-center justify-center text-sm font-medium"
                          style={{
                            backgroundColor: formData.color_primario,
                            color: formData.color_primario_foreground,
                          }}
                        >
                          Primario
                        </div>
                        <div
                          className="flex-1 h-24 rounded-lg flex items-center justify-center text-sm font-medium text-white"
                          style={{ backgroundColor: formData.color_secundario }}
                        >
                          Secundario
                        </div>
                        <div
                          className="flex-1 h-24 rounded-lg flex items-center justify-center text-sm font-medium text-white"
                          style={{ backgroundColor: formData.color_acento }}
                        >
                          Acento
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="images" className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Image className="h-4 w-4" />
                        Logos e Imágenes
                      </CardTitle>
                      <CardDescription>Sube el logo de la empresa en diferentes formatos</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <LogoUploader
                        label="Logo (Modo Claro)"
                        value={formData.logo_light}
                        onChange={(url) => handleChange("logo_light", url)}
                        tenantId={tenant.id}
                        fileType="logo-light"
                        helpText="Recomendado: PNG transparente, 200x60px"
                      />
                      <LogoUploader
                        label="Logo (Modo Oscuro)"
                        value={formData.logo_dark}
                        onChange={(url) => handleChange("logo_dark", url)}
                        tenantId={tenant.id}
                        fileType="logo-dark"
                        helpText="Logo para usar sobre fondos oscuros"
                      />
                      <LogoUploader
                        label="Favicon"
                        value={formData.favicon}
                        onChange={(url) => handleChange("favicon", url)}
                        tenantId={tenant.id}
                        fileType="favicon"
                        accept="image/png,image/x-icon,image/svg+xml"
                        helpText="Icono del navegador, 32x32px o 64x64px"
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="contact" className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Datos de Contacto
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Dirección</Label>
                        <Input
                          value={formData.company_address}
                          onChange={(e) => handleChange("company_address", e.target.value)}
                          placeholder="Av. Principal 123"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Ciudad</Label>
                          <Input
                            value={formData.company_city}
                            onChange={(e) => handleChange("company_city", e.target.value)}
                            placeholder="Buenos Aires"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>País</Label>
                          <Input
                            value={formData.company_country}
                            onChange={(e) => handleChange("company_country", e.target.value)}
                            placeholder="Argentina"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Descripción de la Empresa</Label>
                        <Textarea
                          value={formData.company_description}
                          onChange={(e) => handleChange("company_description", e.target.value)}
                          placeholder="Breve descripción de la empresa..."
                          rows={3}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Redes Sociales</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Facebook</Label>
                          <Input
                            value={formData.social_facebook}
                            onChange={(e) => handleChange("social_facebook", e.target.value)}
                            placeholder="https://facebook.com/..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Instagram</Label>
                          <Input
                            value={formData.social_instagram}
                            onChange={(e) => handleChange("social_instagram", e.target.value)}
                            placeholder="https://instagram.com/..."
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Twitter/X</Label>
                          <Input
                            value={formData.social_twitter}
                            onChange={(e) => handleChange("social_twitter", e.target.value)}
                            placeholder="https://twitter.com/..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>LinkedIn</Label>
                          <Input
                            value={formData.social_linkedin}
                            onChange={(e) => handleChange("social_linkedin", e.target.value)}
                            placeholder="https://linkedin.com/..."
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>WhatsApp</Label>
                        <Input
                          value={formData.social_whatsapp}
                          onChange={(e) => handleChange("social_whatsapp", e.target.value)}
                          placeholder="+54 9 11 1234-5678"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar Cambios
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
