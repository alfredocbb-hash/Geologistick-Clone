import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Building2, MapPin, ArrowRight, Loader2, Check, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';

const steps = [
  { id: 1, title: 'Tu Empresa', icon: Building2 },
  { id: 2, title: 'Sucursal Principal', icon: MapPin },
  { id: 3, title: '¡Listo!', icon: Check },
];

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombreEmpresa: '',
    tipoNegocio: '',
    direccionSucursal: '',
    ciudadSucursal: '',
    telefonoSucursal: '',
  });

  const { user, profile, loading: authLoading } = useAuth();
  const { tenant, isLoading: tenantLoading } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  // Check if onboarding is already completed
  useEffect(() => {
    if (tenant && tenant.nombre !== 'Mi Empresa') {
      // Already completed onboarding
      navigate('/dashboard');
    }
  }, [tenant, navigate]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStep1Submit = async () => {
    if (!formData.nombreEmpresa.trim()) {
      toast({
        title: 'Campo requerido',
        description: 'Por favor ingresa el nombre de tu empresa.',
        variant: 'destructive',
      });
      return;
    }

    setCurrentStep(2);
  };

  const handleStep2Submit = async () => {
    if (!formData.direccionSucursal.trim()) {
      toast({
        title: 'Campo requerido',
        description: 'Por favor ingresa la dirección de tu sucursal.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Get tenant ID from profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user?.id)
        .single();

      if (!profileData?.tenant_id) {
        throw new Error('No se encontró tu empresa');
      }

      const tenantId = profileData.tenant_id;

      // Update tenant name
      await supabase
        .from('tenants')
        .update({ 
          nombre: formData.nombreEmpresa,
          configuracion: { tipo_negocio: formData.tipoNegocio }
        })
        .eq('id', tenantId);

      // Update branding
      await supabase
        .from('tenant_branding')
        .update({ nombre_app: formData.nombreEmpresa })
        .eq('tenant_id', tenantId);

      // Update main branch
      await supabase
        .from('sucursales')
        .update({
          nombre: `${formData.nombreEmpresa} - Principal`,
          direccion: formData.direccionSucursal,
          ciudad: formData.ciudadSucursal || null,
          telefono: formData.telefonoSucursal || null,
        })
        .eq('tenant_id', tenantId)
        .eq('codigo', 'MAIN');

      setCurrentStep(3);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo guardar la configuración.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = () => {
    navigate('/dashboard');
  };

  if (authLoading || tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Logo & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-colored">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Configuración Inicial</h1>
          <p className="text-muted-foreground">Configura tu empresa en minutos</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center gap-2">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                step.id === currentStep
                  ? 'bg-primary text-primary-foreground'
                  : step.id < currentStep
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <step.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{step.title}</span>
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card className="shadow-xl border-0 bg-card/80 backdrop-blur-sm">
          {currentStep === 1 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Información de tu Empresa
                </CardTitle>
                <CardDescription>
                  Cuéntanos sobre tu negocio de logística
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nombreEmpresa">Nombre de la Empresa *</Label>
                  <Input
                    id="nombreEmpresa"
                    placeholder="Ej: Transportes Rápidos S.A."
                    value={formData.nombreEmpresa}
                    onChange={(e) => handleInputChange('nombreEmpresa', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipoNegocio">Tipo de Negocio</Label>
                  <Select
                    value={formData.tipoNegocio}
                    onValueChange={(value) => handleInputChange('tipoNegocio', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el tipo de negocio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensajeria">Mensajería y Paquetería</SelectItem>
                      <SelectItem value="carga">Transporte de Carga</SelectItem>
                      <SelectItem value="ecommerce">Logística E-commerce</SelectItem>
                      <SelectItem value="distribucion">Distribución</SelectItem>
                      <SelectItem value="mudanzas">Mudanzas</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full gradient-primary" 
                  onClick={handleStep1Submit}
                >
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </>
          )}

          {currentStep === 2 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Tu Sucursal Principal
                </CardTitle>
                <CardDescription>
                  Configura tu primera sucursal
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="direccionSucursal">Dirección *</Label>
                  <Input
                    id="direccionSucursal"
                    placeholder="Calle, número, localidad"
                    value={formData.direccionSucursal}
                    onChange={(e) => handleInputChange('direccionSucursal', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ciudadSucursal">Ciudad</Label>
                    <Input
                      id="ciudadSucursal"
                      placeholder="Ciudad"
                      value={formData.ciudadSucursal}
                      onChange={(e) => handleInputChange('ciudadSucursal', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefonoSucursal">Teléfono</Label>
                    <Input
                      id="telefonoSucursal"
                      placeholder="+54 11 1234-5678"
                      value={formData.telefonoSucursal}
                      onChange={(e) => handleInputChange('telefonoSucursal', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentStep(1)}
                  className="flex-1"
                >
                  Atrás
                </Button>
                <Button 
                  className="flex-1 gradient-primary" 
                  onClick={handleStep2Submit}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      Finalizar
                      <Check className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </>
          )}

          {currentStep === 3 && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle>¡Todo Listo!</CardTitle>
                <CardDescription>
                  Tu empresa ha sido configurada exitosamente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-center">
                <div className="bg-primary/5 rounded-lg p-4 space-y-2">
                  <p className="font-medium">{formData.nombreEmpresa}</p>
                  <p className="text-sm text-muted-foreground">{formData.direccionSucursal}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 text-sm">
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    🎁 14 días de prueba gratis
                  </p>
                  <p className="text-amber-600 dark:text-amber-500">
                    Explora todas las funcionalidades sin límites
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full gradient-primary" 
                  onClick={handleFinish}
                >
                  Ir al Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Podrás modificar esta configuración más adelante en Ajustes
        </p>
      </div>
    </div>
  );
}