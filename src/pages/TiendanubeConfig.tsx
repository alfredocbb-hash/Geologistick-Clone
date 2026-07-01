import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Store, 
  RefreshCw,
  Mail,
  Settings,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SellerData {
  id: string;
  nombre: string;
  store_id: string;
  store_url: string | null;
  activo: boolean;
  ultimo_sync: string | null;
  has_valid_token: boolean | null;
}

const TiendanubeConfig = () => {
  const [searchParams] = useSearchParams();
  const storeId = searchParams.get("store_id");
  
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<SellerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSellerByStoreId = async () => {
      if (!storeId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("ecommerce_sellers")
          .select("id, nombre, store_id, store_url, activo, ultimo_sync, has_valid_token")
          .eq("store_id", storeId)
          .eq("plataforma", "tiendanube")
          .maybeSingle();

        if (fetchError) {
          console.error("Error fetching seller:", fetchError);
          setError("Error al buscar la tienda");
        } else if (data) {
          setSeller(data);
        }
      } catch (err) {
        console.error("Error:", err);
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    };

    fetchSellerByStoreId();
  }, [storeId]);

  const isConnected = seller?.access_token !== null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 py-16 md:py-24">
        <div className="container max-w-2xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Store className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Configuración de Tiendanube
            </h1>
            <p className="text-muted-foreground">
              Gestiona tu integración con Geologistick
            </p>
          </div>

          {loading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Cargando información...</p>
              </CardContent>
            </Card>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : !storeId ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  Acceso Directo
                </CardTitle>
                <CardDescription>
                  Esta página debe ser accedida desde TiendaNube
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Para configurar tu integración con Geologistick, accede desde el 
                  panel de aplicaciones de tu tienda en TiendaNube.
                </p>
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium text-foreground mb-2">¿Necesitas ayuda?</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Si tienes problemas con tu integración, contacta a nuestro equipo de soporte:
                  </p>
                  <a 
                    href="mailto:soporte@geologistick.com"
                    className="inline-flex items-center gap-2 text-primary hover:underline"
                  >
                    <Mail className="h-4 w-4" />
                    soporte@geologistick.com
                  </a>
                </div>
              </CardContent>
            </Card>
          ) : !seller ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  Tienda No Encontrada
                </CardTitle>
                <CardDescription>
                  Store ID: {storeId}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No encontramos una integración activa para esta tienda. Esto puede ocurrir si:
                  </AlertDescription>
                </Alert>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground text-sm">
                  <li>La aplicación fue desinstalada previamente</li>
                  <li>La tienda aún no completó el proceso de autorización</li>
                  <li>Hubo un error durante la instalación</li>
                </ul>
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium text-foreground mb-2">Pasos para conectar tu tienda:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Ve a la tienda de aplicaciones de TiendaNube</li>
                    <li>Busca "Geologistick" e instala la aplicación</li>
                    <li>Autoriza el acceso cuando se te solicite</li>
                    <li>¡Listo! Tus pedidos se sincronizarán automáticamente</li>
                  </ol>
                </div>
                <p className="text-sm text-muted-foreground">
                  ¿Problemas? Contáctanos en{" "}
                  <a href="mailto:soporte@geologistick.com" className="text-primary hover:underline">
                    soporte@geologistick.com
                  </a>
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {isConnected ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      {seller.nombre}
                    </CardTitle>
                    <CardDescription>
                      Store ID: {seller.store_id}
                    </CardDescription>
                  </div>
                  <Badge variant={seller.activo ? "default" : "secondary"}>
                    {seller.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Connection Status */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Estado de la Integración
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Conexión</span>
                      <span className={isConnected ? "text-green-500" : "text-destructive"}>
                        {isConnected ? "Conectado" : "Desconectado"}
                      </span>
                    </div>
                    {seller.store_url && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">URL de la tienda</span>
                        <a 
                          href={seller.store_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          Visitar
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                    {seller.ultimo_sync && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Última sincronización</span>
                        <span className="text-foreground">
                          {new Date(seller.ultimo_sync).toLocaleString("es-AR")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {isConnected ? (
                  <Alert className="bg-green-500/10 border-green-500/20">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-700 dark:text-green-300">
                      Tu tienda está conectada correctamente. Los pedidos se sincronizarán 
                      automáticamente.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      La conexión con tu tienda se ha perdido. Reinstala la aplicación 
                      desde TiendaNube para reconectar.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Help Section */}
                <div className="border-t pt-6">
                  <h4 className="font-medium text-foreground mb-3">¿Necesitas ayuda?</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Si tienes problemas con la integración o necesitas asistencia, 
                    nuestro equipo de soporte está disponible para ayudarte.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button variant="outline" asChild>
                      <a href="mailto:soporte@geologistick.com">
                        <Mail className="mr-2 h-4 w-4" />
                        Contactar Soporte
                      </a>
                    </Button>
                    <Button variant="outline" asChild>
                      <a href="/support">
                        Ir a Centro de Ayuda
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TiendanubeConfig;
