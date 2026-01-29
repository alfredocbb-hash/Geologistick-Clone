import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Lock, User, MapPin, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import geologistickLogo from "@/assets/geologistick-logo.png";

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Animate content on mount
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: "Error al iniciar sesión",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "¡Bienvenido!",
        description: "Has iniciado sesión correctamente.",
      });
      navigate("/dashboard");
    }

    setIsLoading(false);
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const nombre = formData.get("nombre") as string;

    const { error } = await signUp(email, password, nombre);

    if (error) {
      toast({
        title: "Error al registrarse",
        description: error.message,
        variant: "destructive",
      });
      setIsLoading(false);
    } else {
      toast({
        title: "¡Cuenta creada!",
        description: "Redirigiendo a configuración...",
      });
      // Auto-login and redirect to onboarding
      const { error: loginError } = await signIn(email, password);
      if (!loginError) {
        navigate("/onboarding");
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -left-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}
        />
        
        {/* Floating icons */}
        <div className="absolute top-20 left-10 opacity-10 animate-bounce" style={{ animationDuration: '3s' }}>
          <Truck className="w-8 h-8 text-white" />
        </div>
        <div className="absolute top-40 right-8 opacity-10 animate-bounce" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}>
          <MapPin className="w-6 h-6 text-white" />
        </div>
        <div className="absolute bottom-32 left-20 opacity-10 animate-bounce" style={{ animationDuration: '2.8s', animationDelay: '1s' }}>
          <Truck className="w-6 h-6 text-white" />
        </div>
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Logo & Title */}
        <div 
          className={`text-center space-y-4 transition-all duration-700 ${
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {/* Glowing logo container */}
          <div className="relative mx-auto w-fit">
            <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-xl animate-pulse" />
            <img 
              src={geologistickLogo} 
              alt="Geologistick" 
              className="relative w-20 h-20 mx-auto rounded-2xl object-contain shadow-2xl shadow-primary/40 transform hover:scale-105 transition-transform"
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Geologistick</h1>
          <p className="text-slate-400">Sistema de Gestión Logística</p>
        </div>

        {/* Login/Register Card */}
        <Card 
          className={`shadow-xl border-slate-800/50 bg-slate-900/60 backdrop-blur-xl transition-all duration-700 delay-200 ${
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <Tabs defaultValue="login" className="w-full">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800/50">
                <TabsTrigger value="login" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Iniciar Sesión
                </TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Registrarse
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="login">
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-slate-300">Correo electrónico</Label>
                    <div className="relative group">
                      <div className="absolute inset-0 bg-primary/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors z-10" />
                      <Input
                        id="login-email"
                        name="email"
                        type="email"
                        placeholder="tu@email.com"
                        className="relative pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/30"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-slate-300">Contraseña</Label>
                    <div className="relative group">
                      <div className="absolute inset-0 bg-primary/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors z-10" />
                      <Input
                        id="login-password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        className="relative pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/30"
                        required
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-primary via-primary to-emerald-500 hover:opacity-90 text-white font-semibold shadow-lg shadow-primary/30 transition-all active:scale-[0.98]" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Iniciando...
                      </>
                    ) : (
                      "Iniciar Sesión"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-nombre" className="text-slate-300">Nombre</Label>
                    <div className="relative group">
                      <div className="absolute inset-0 bg-primary/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors z-10" />
                      <Input
                        id="register-nombre"
                        name="nombre"
                        type="text"
                        placeholder="Tu nombre"
                        className="relative pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/30"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email" className="text-slate-300">Correo electrónico</Label>
                    <div className="relative group">
                      <div className="absolute inset-0 bg-primary/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors z-10" />
                      <Input
                        id="register-email"
                        name="email"
                        type="email"
                        placeholder="tu@email.com"
                        className="relative pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/30"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-slate-300">Contraseña</Label>
                    <div className="relative group">
                      <div className="absolute inset-0 bg-primary/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors z-10" />
                      <Input
                        id="register-password"
                        name="password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        className="relative pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/30"
                        minLength={6}
                        required
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-primary via-primary to-emerald-500 hover:opacity-90 text-white font-semibold shadow-lg shadow-primary/30 transition-all active:scale-[0.98]" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creando cuenta...
                      </>
                    ) : (
                      "Crear Cuenta"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>

        <p 
          className={`text-center text-sm text-slate-600 transition-all duration-700 delay-500 ${
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          © 2026 Geologistick. Sistema de Gestión Logística.
        </p>
      </div>
    </div>
  );
}
