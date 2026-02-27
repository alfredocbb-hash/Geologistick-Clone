import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DollarSign, Download, FileText, Info, Loader2, MessageCircle, Scale, Settings, Shield, ShoppingCart, Truck } from "lucide-react";
import { generateUserGuidePDF } from "@/lib/generateUserGuidePDF";
import { generateEcommerceGuidePDF } from "@/lib/generateEcommerceGuidePDF";
import { generateRatesGuidePDF } from "@/lib/generateRatesGuidePDF";
import { generateFlexGuidePDF } from "@/lib/generateFlexGuidePDF";
import { generateFlexTermsPDF } from "@/lib/generateFlexTermsPDF";
import { generateSuperAdminGuidePDF } from "@/lib/generateSuperAdminGuidePDF";
import { useTenantContext } from "@/components/providers/TenantProvider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const SystemSettings = () => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingEcommercePDF, setIsGeneratingEcommercePDF] = useState(false);
  const [isGeneratingRatesPDF, setIsGeneratingRatesPDF] = useState(false);
  const [isGeneratingFlexPDF, setIsGeneratingFlexPDF] = useState(false);
  const [isGeneratingFlexTermsPDF, setIsGeneratingFlexTermsPDF] = useState(false);
  const [isGeneratingSuperAdminPDF, setIsGeneratingSuperAdminPDF] = useState(false);
  const { tenant, branding } = useTenantContext();
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin } = useAuth();
  const showFlexCards = isAdmin() && tenant?.ecommerce_enabled === true;

  const handleDownloadGuide = async () => {
    setIsGeneratingPDF(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      await generateUserGuidePDF();
      toast({
        title: "PDF generado",
        description: "La guía de usuario se ha descargado correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar el PDF. Intente nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleDownloadEcommerceGuide = async () => {
    setIsGeneratingEcommercePDF(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      await generateEcommerceGuidePDF();
      toast({
        title: "PDF generado",
        description: "La guía de e-Commerce se ha descargado correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar el PDF. Intente nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingEcommercePDF(false);
    }
  };

  const handleDownloadRatesGuide = async () => {
    setIsGeneratingRatesPDF(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      await generateRatesGuidePDF();
      toast({
        title: "PDF generado",
        description: "La guía de Tarifas se ha descargado correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar el PDF. Intente nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingRatesPDF(false);
    }
  };

  const getFlexBranding = () => ({
    tenantName: branding?.nombre_app || tenant?.nombre || 'Mi Empresa',
    logoUrl: branding?.logo_light || null,
    primaryColor: branding?.color_primario || '#EAB308',
  });

  const handleDownloadFlexGuide = async () => {
    setIsGeneratingFlexPDF(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      await generateFlexGuidePDF(getFlexBranding());
      toast({
        title: "PDF generado",
        description: "La guía de Envíos Flex se ha descargado correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar el PDF. Intente nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingFlexPDF(false);
    }
  };

  const handleShareFlexWhatsApp = async () => {
    setIsGeneratingFlexPDF(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      await generateFlexGuidePDF(getFlexBranding());
      const name = getFlexBranding().tenantName;
      const message = encodeURIComponent(
        `¡Hola! Te comparto la Guía Operativa de Envíos Flex de ${name}. Por favor revisá el archivo adjunto.`
      );
      window.open(`https://wa.me/?text=${message}`, '_blank');
      toast({
        title: "PDF descargado",
        description: "Adjuntá el PDF descargado en el chat de WhatsApp.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar el PDF. Intente nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingFlexPDF(false);
    }
  };

  const handleDownloadFlexTerms = async () => {
    setIsGeneratingFlexTermsPDF(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      await generateFlexTermsPDF(getFlexBranding());
      toast({
        title: "PDF generado",
        description: "Los Términos y Condiciones Flex se han descargado correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar el PDF. Intente nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingFlexTermsPDF(false);
    }
  };

  const handleShareFlexTermsWhatsApp = async () => {
    setIsGeneratingFlexTermsPDF(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      await generateFlexTermsPDF(getFlexBranding());
      const name = getFlexBranding().tenantName;
      const message = encodeURIComponent(
        `¡Hola! Te comparto los Términos y Condiciones del servicio Flex de ${name}. Por favor revisá el archivo adjunto.`
      );
      window.open(`https://wa.me/?text=${message}`, '_blank');
      toast({
        title: "PDF descargado",
        description: "Adjuntá el PDF descargado en el chat de WhatsApp.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar el PDF. Intente nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingFlexTermsPDF(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Configuración del Sistema
        </h1>
        <p className="text-muted-foreground">
          Ajustes generales y documentación del sistema
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* User Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Guía de Usuario
            </CardTitle>
            <CardDescription>
              Manual general del sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-lg border bg-card">
              <div className="p-3 rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Manual Completo</h3>
                  <Badge variant="secondary">PDF</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Instrucciones para todas las funciones del sistema Geologistick.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                  <li>• Gestión de envíos y tracking</li>
                  <li>• Hojas de ruta y planificación</li>
                  <li>• Navegación para choferes</li>
                  <li>• Finanzas y liquidaciones</li>
                </ul>
              </div>
            </div>
            
            <Button 
              onClick={handleDownloadGuide} 
              className="w-full"
              disabled={isGeneratingPDF}
            >
              {isGeneratingPDF ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando PDF...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar Guía de Usuario
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* e-Commerce Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Guía de e-Commerce
            </CardTitle>
            <CardDescription>
              Manual del módulo de tiendas online
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-lg border bg-card">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <ShoppingCart className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Módulo e-Commerce</h3>
                  <Badge variant="secondary">PDF</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Guía completa para gestionar tiendas online conectadas.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                  <li>• Gestión de Sellers</li>
                  <li>• Integración con Tiendanube</li>
                  <li>• Relación con sucursales</li>
                  <li>• Liquidaciones de sellers</li>
                </ul>
              </div>
            </div>
            
            <Button 
              onClick={handleDownloadEcommerceGuide} 
              className="w-full"
              variant="outline"
              disabled={isGeneratingEcommercePDF}
            >
              {isGeneratingEcommercePDF ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando PDF...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar Guía e-Commerce
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Rates Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Guía de Tarifas
            </CardTitle>
            <CardDescription>
              Manual de configuración de precios
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-lg border bg-card">
              <div className="p-3 rounded-lg bg-amber-500/10">
                <DollarSign className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Módulo de Tarifas</h3>
                  <Badge variant="secondary">PDF</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Guía completa para configurar precios de envíos.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                  <li>• Tipos de tarifas (peso, km, volumen)</li>
                  <li>• Rangos escalonados de precio</li>
                  <li>• Conceptos adicionales y seguro</li>
                  <li>• Ajustes masivos de precios</li>
                </ul>
              </div>
            </div>
            
            <Button 
              onClick={handleDownloadRatesGuide} 
              className="w-full"
              variant="outline"
              disabled={isGeneratingRatesPDF}
            >
              {isGeneratingRatesPDF ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando PDF...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar Guía de Tarifas
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {showFlexCards && (<>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Guía Envíos Flex
            </CardTitle>
            <CardDescription>
              Guía operativa para Mercado Libre Flex
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-lg border bg-card">
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <Truck className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">ML Flex - {branding?.nombre_app || tenant?.nombre || 'Mi Empresa'}</h3>
                  <Badge variant="secondary">PDF</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Guía con onboarding, horarios de retiro y tarifario vigente.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                  <li>• Proceso de alta de servicio</li>
                  <li>• Horarios y logística de retiro</li>
                  <li>• Tarifario por zonas</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleDownloadFlexGuide}
                className="flex-1"
                variant="outline"
                disabled={isGeneratingFlexPDF}
              >
                {isGeneratingFlexPDF ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar
                  </>
                )}
              </Button>
              <Button
                onClick={handleShareFlexWhatsApp}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                disabled={isGeneratingFlexPDF}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Flex Terms */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Términos Flex
            </CardTitle>
            <CardDescription>
              Condiciones comerciales para vendedores Flex
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-lg border bg-card">
              <div className="p-3 rounded-lg bg-orange-500/10">
                <Scale className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">T&C Flex - {branding?.nombre_app || tenant?.nombre || 'Mi Empresa'}</h3>
                  <Badge variant="secondary">PDF</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Términos y condiciones del servicio de logística Flex.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                  <li>• Tarifas y facturación</li>
                  <li>• Intentos de entrega</li>
                  <li>• Liquidaciones y pagos</li>
                  <li>• Compromiso de servicio</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleDownloadFlexTerms}
                className="flex-1"
                variant="outline"
                disabled={isGeneratingFlexTermsPDF}
              >
                {isGeneratingFlexTermsPDF ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar
                  </>
                )}
              </Button>
              <Button
                onClick={handleShareFlexTermsWhatsApp}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                disabled={isGeneratingFlexTermsPDF}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
        </>)}
        {/* Super Admin Guide */}
        {isSuperAdmin() && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Guía de Super Administrador
              </CardTitle>
              <CardDescription>
                Manual de gestión del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-lg border bg-card">
                <div className="p-3 rounded-lg bg-purple-500/10">
                  <Shield className="h-6 w-6 text-purple-600" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Panel de Control</h3>
                    <Badge variant="secondary">PDF</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Guía completa para la administración central del sistema.
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                    <li>• Gestión de tenants y usuarios</li>
                    <li>• Branding, permisos y API Keys</li>
                    <li>• Planes, suscripciones y federación</li>
                    <li>• Solicitudes de trial</li>
                  </ul>
                </div>
              </div>
              
              <Button 
                onClick={async () => {
                  setIsGeneratingSuperAdminPDF(true);
                  try {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await generateSuperAdminGuidePDF();
                    toast({
                      title: "PDF generado",
                      description: "La guía de Super Administrador se ha descargado correctamente.",
                    });
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "No se pudo generar el PDF. Intente nuevamente.",
                      variant: "destructive",
                    });
                  } finally {
                    setIsGeneratingSuperAdminPDF(false);
                  }
                }}
                className="w-full"
                variant="outline"
                disabled={isGeneratingSuperAdminPDF}
              >
                {isGeneratingSuperAdminPDF ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando PDF...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar Guía Super Admin
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Información del Sistema
            </CardTitle>
            <CardDescription>
              Detalles técnicos de la aplicación
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Aplicación</span>
                <span className="font-medium">Geologistick</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Versión</span>
                <Badge>1.0.0</Badge>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Plataforma</span>
                <span className="font-medium">Web / Android</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Base de datos</span>
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                  Conectada
                </Badge>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t">
              <h4 className="font-medium mb-2">Soporte Técnico</h4>
              <p className="text-sm text-muted-foreground">
                Para consultas o reportar problemas, contacte al administrador del sistema.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SystemSettings;
