import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Image, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

type FormatType = "post" | "story" | "banner";

const THEMES = [
  { id: "01-hero", label: "Hero / General", description: "Logística inteligente para tu empresa" },
  { id: "02-tracking", label: "Tracking en tiempo real", description: "Rastreá tus envíos en tiempo real" },
  { id: "03-mobile", label: "App móvil", description: "Tu operación desde el celular" },
  { id: "04-ecommerce", label: "E-commerce", description: "Conectá tu tienda online" },
  { id: "05-routes", label: "Optimización de rutas", description: "Rutas optimizadas con IA" },
  { id: "06-reports", label: "Reportes y liquidaciones", description: "Métricas y liquidaciones automáticas" },
];

const FORMAT_INFO: Record<FormatType, { label: string; size: string }> = {
  post: { label: "Post Instagram", size: "1080×1080" },
  story: { label: "Story", size: "1080×1920" },
  banner: { label: "Banner WhatsApp", size: "1200×630" },
};

const MarketingAssets = () => {
  const [selectedFormat, setSelectedFormat] = useState<FormatType>("post");
  const { toast } = useToast();

  const { data: assets, isLoading } = useQuery({
    queryKey: ["marketing-assets"],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("marketing-assets")
        .list("", { limit: 100 });
      if (error) throw error;
      return data || [];
    },
  });

  const getImageUrl = (themeId: string, format: FormatType) => {
    const fileName = `${themeId}-${format}.png`;
    const { data } = supabase.storage
      .from("marketing-assets")
      .getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleDownload = async (themeId: string, format: FormatType) => {
    const fileName = `${themeId}-${format}.png`;
    const { data, error } = await supabase.storage
      .from("marketing-assets")
      .download(fileName);

    if (error) {
      toast({ title: "Error", description: "No se pudo descargar la imagen", variant: "destructive" });
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `geologistick-${themeId}-${format}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    toast({ title: "Descargando...", description: `Descargando ${THEMES.length} imágenes en formato ${FORMAT_INFO[selectedFormat].label}` });
    for (const theme of THEMES) {
      await handleDownload(theme.id, selectedFormat);
      await new Promise(r => setTimeout(r, 500));
    }
    toast({ title: "Listo", description: "Todas las imágenes fueron descargadas" });
  };

  const hasAssets = assets && assets.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Image className="h-6 w-6 text-primary" />
            Material Promocional
          </h1>
          <p className="text-muted-foreground mt-1">
            Imágenes listas para compartir en redes sociales y WhatsApp
          </p>
        </div>
        {hasAssets && (
          <Button onClick={handleDownloadAll} className="gap-2">
            <Download className="h-4 w-4" />
            Descargar todo ({FORMAT_INFO[selectedFormat].label})
          </Button>
        )}
      </div>

      <Tabs value={selectedFormat} onValueChange={(v) => setSelectedFormat(v as FormatType)}>
        <TabsList>
          {Object.entries(FORMAT_INFO).map(([key, info]) => (
            <TabsTrigger key={key} value={key} className="gap-2">
              {info.label}
              <Badge variant="secondary" className="text-xs">{info.size}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!hasAssets && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sin imágenes cargadas</h3>
            <p className="text-muted-foreground">
              Las imágenes promocionales aún no fueron subidas al almacenamiento.
              Contactá al administrador para cargarlas.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="w-full aspect-square rounded-md mb-3" />
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))
          : THEMES.map((theme) => (
              <Card key={theme.id} className="overflow-hidden group">
                <CardContent className="p-0">
                  <div className={`relative bg-muted ${
                    selectedFormat === "story" ? "aspect-[9/16] max-h-[400px]" :
                    selectedFormat === "banner" ? "aspect-[1200/630]" : "aspect-square"
                  } overflow-hidden`}>
                    {hasAssets ? (
                      <img
                        src={getImageUrl(theme.id, selectedFormat)}
                        alt={theme.label}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    {hasAssets && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDownload(theme.id, selectedFormat)}
                          className="gap-1"
                        >
                          <Download className="h-3 w-3" />
                          Descargar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            const url = getImageUrl(theme.id, selectedFormat);
                            window.open(url, "_blank");
                          }}
                          className="gap-1"
                        >
                          <Share2 className="h-3 w-3" />
                          Abrir
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-sm">{theme.label}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{theme.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
};

export default MarketingAssets;
