import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Globe, Sparkles, Settings } from "lucide-react";
import { useLandingContent, useUpdateLandingContent, HeroContent, FeaturesContent, GeneralContent } from "@/hooks/useLandingContent";
import { toast } from "sonner";

export default function LandingContentAdmin() {
  const { data: content, isLoading } = useLandingContent();
  const updateMutation = useUpdateLandingContent();
  
  const [heroForm, setHeroForm] = useState<HeroContent | null>(null);
  const [featuresForm, setFeaturesForm] = useState<FeaturesContent | null>(null);
  const [generalForm, setGeneralForm] = useState<GeneralContent | null>(null);

  // Initialize forms when data loads
  if (content && !heroForm) setHeroForm(content.hero || null);
  if (content && !featuresForm) setFeaturesForm(content.features || null);
  if (content && !generalForm) setGeneralForm(content.general || null);

  const handleSaveHero = async () => {
    if (!heroForm) return;
    try {
      await updateMutation.mutateAsync({ section: "hero", content: heroForm });
      toast.success("Sección Hero actualizada");
    } catch (error) {
      toast.error("Error al guardar");
    }
  };

  const handleSaveFeatures = async () => {
    if (!featuresForm) return;
    try {
      await updateMutation.mutateAsync({ section: "features", content: featuresForm });
      toast.success("Sección Features actualizada");
    } catch (error) {
      toast.error("Error al guardar");
    }
  };

  const handleSaveGeneral = async () => {
    if (!generalForm) return;
    try {
      await updateMutation.mutateAsync({ section: "general", content: generalForm });
      toast.success("Configuración general actualizada");
    } catch (error) {
      toast.error("Error al guardar");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Contenido Landing Page</h1>
          <p className="text-muted-foreground">
            Edita los textos y configuraciones de la página principal
          </p>
        </div>

        <Tabs defaultValue="hero" className="space-y-4">
          <TabsList>
            <TabsTrigger value="hero" className="gap-2">
              <Globe className="h-4 w-4" />
              Hero
            </TabsTrigger>
            <TabsTrigger value="features" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Features
            </TabsTrigger>
            <TabsTrigger value="general" className="gap-2">
              <Settings className="h-4 w-4" />
              General
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hero">
            <Card>
              <CardHeader>
                <CardTitle>Sección Hero</CardTitle>
                <CardDescription>
                  El banner principal que ven los visitantes al entrar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {heroForm && (
                  <>
                    <div className="space-y-2">
                      <Label>Badge (Etiqueta superior)</Label>
                      <Input
                        value={heroForm.badge_text}
                        onChange={(e) => setHeroForm({ ...heroForm, badge_text: e.target.value })}
                        placeholder="Ej: Plataforma #1 de Logística"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Título (Línea 1)</Label>
                        <Input
                          value={heroForm.title_line1}
                          onChange={(e) => setHeroForm({ ...heroForm, title_line1: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Título (Línea 2 - Destacada)</Label>
                        <Input
                          value={heroForm.title_line2}
                          onChange={(e) => setHeroForm({ ...heroForm, title_line2: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Descripción</Label>
                      <Textarea
                        value={heroForm.description}
                        onChange={(e) => setHeroForm({ ...heroForm, description: e.target.value })}
                        rows={3}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Botón Principal (CTA)</Label>
                        <Input
                          value={heroForm.cta_primary}
                          onChange={(e) => setHeroForm({ ...heroForm, cta_primary: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Botón Secundario</Label>
                        <Input
                          value={heroForm.cta_secondary}
                          onChange={(e) => setHeroForm({ ...heroForm, cta_secondary: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Estadísticas</Label>
                      <div className="grid grid-cols-3 gap-4">
                        {heroForm.stats.map((stat, i) => (
                          <div key={i} className="p-3 border rounded-lg space-y-2">
                            <Input
                              value={stat.value}
                              onChange={(e) => {
                                const newStats = [...heroForm.stats];
                                newStats[i] = { ...stat, value: e.target.value };
                                setHeroForm({ ...heroForm, stats: newStats });
                              }}
                              placeholder="Valor"
                            />
                            <Input
                              value={stat.label}
                              onChange={(e) => {
                                const newStats = [...heroForm.stats];
                                newStats[i] = { ...stat, label: e.target.value };
                                setHeroForm({ ...heroForm, stats: newStats });
                              }}
                              placeholder="Etiqueta"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <Button onClick={handleSaveHero} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Guardar Hero
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="features">
            <Card>
              <CardHeader>
                <CardTitle>Sección Features</CardTitle>
                <CardDescription>
                  Textos del encabezado de la sección de características
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {featuresForm && (
                  <>
                    <div className="space-y-2">
                      <Label>Badge (Etiqueta superior)</Label>
                      <Input
                        value={featuresForm.badge_text}
                        onChange={(e) => setFeaturesForm({ ...featuresForm, badge_text: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input
                        value={featuresForm.title}
                        onChange={(e) => setFeaturesForm({ ...featuresForm, title: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Subtítulo</Label>
                      <Textarea
                        value={featuresForm.subtitle}
                        onChange={(e) => setFeaturesForm({ ...featuresForm, subtitle: e.target.value })}
                        rows={2}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Texto de Contacto</Label>
                        <Input
                          value={featuresForm.contact_text}
                          onChange={(e) => setFeaturesForm({ ...featuresForm, contact_text: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CTA de Contacto</Label>
                        <Input
                          value={featuresForm.contact_cta}
                          onChange={(e) => setFeaturesForm({ ...featuresForm, contact_cta: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <Button onClick={handleSaveFeatures} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Guardar Features
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Configuración General</CardTitle>
                <CardDescription>
                  Textos de pricing, trial y configuraciones globales
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {generalForm && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Días de Trial</Label>
                        <Input
                          type="number"
                          value={generalForm.trial_days}
                          onChange={(e) => setGeneralForm({ ...generalForm, trial_days: parseInt(e.target.value) || 14 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Texto de Trial</Label>
                        <Input
                          value={generalForm.trial_text}
                          onChange={(e) => setGeneralForm({ ...generalForm, trial_text: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Título de Precios</Label>
                      <Input
                        value={generalForm.pricing_title}
                        onChange={(e) => setGeneralForm({ ...generalForm, pricing_title: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Subtítulo de Precios</Label>
                      <Textarea
                        value={generalForm.pricing_subtitle}
                        onChange={(e) => setGeneralForm({ ...generalForm, pricing_subtitle: e.target.value })}
                        rows={2}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Etiqueta de Moneda</Label>
                        <Input
                          value={generalForm.currency_label}
                          onChange={(e) => setGeneralForm({ ...generalForm, currency_label: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email de Contacto</Label>
                        <Input
                          value={generalForm.contact_email}
                          onChange={(e) => setGeneralForm({ ...generalForm, contact_email: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <Button onClick={handleSaveGeneral} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Guardar General
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    
  );
}
