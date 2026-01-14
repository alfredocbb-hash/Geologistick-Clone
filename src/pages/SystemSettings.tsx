import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, FileText, Info, Loader2, Settings } from "lucide-react";
import { generateUserGuidePDF } from "@/lib/generateUserGuidePDF";
import { useToast } from "@/hooks/use-toast";

const SystemSettings = () => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const { toast } = useToast();

  const handleDownloadGuide = async () => {
    setIsGeneratingPDF(true);
    try {
      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 500));
      generateUserGuidePDF();
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

      <div className="grid gap-6 md:grid-cols-2">
        {/* Documentation Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documentación
            </CardTitle>
            <CardDescription>
              Recursos y manuales del sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-lg border bg-card">
              <div className="p-3 rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Guía de Usuario</h3>
                  <Badge variant="secondary">PDF</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Manual completo con instrucciones detalladas para todas las funciones del sistema LogiTrack.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                  <li>• Gestión de envíos y tracking</li>
                  <li>• Hojas de ruta y planificación</li>
                  <li>• Navegación para choferes</li>
                  <li>• Finanzas y liquidaciones</li>
                  <li>• Administración del sistema</li>
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

        {/* System Info Section */}
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
                <span className="font-medium">LogiTrack</span>
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
