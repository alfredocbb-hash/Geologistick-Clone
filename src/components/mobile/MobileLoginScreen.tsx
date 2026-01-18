import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Truck, Mail, Lock, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export function MobileLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const { signIn } = useAuth();

  // Animate content on mount
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Por favor complete todos los campos');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error.message || 'Error al iniciar sesión');
      }
    } catch (error) {
      toast.error('Error al conectar con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 overflow-hidden">
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
      </div>

      {/* Logo and branding */}
      <div 
        className={`relative z-10 flex flex-col items-center mb-10 transition-all duration-700 ${
          showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        {/* Glowing logo container */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/30 rounded-3xl blur-xl animate-pulse" />
          <div className="relative w-28 h-28 bg-gradient-to-br from-primary via-primary/80 to-emerald-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-primary/40 transform hover:scale-105 transition-transform">
            <Truck className="w-14 h-14 text-white" strokeWidth={1.5} />
          </div>
        </div>
        
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
          Chofer<span className="text-primary">App</span>
        </h1>
        <p className="text-slate-400 text-center text-sm max-w-[200px]">
          Tu herramienta de gestión de entregas
        </p>
      </div>

      {/* Login form */}
      <form 
        onSubmit={handleLogin} 
        className={`relative z-10 w-full max-w-sm space-y-5 transition-all duration-700 delay-200 ${
          showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        {/* Glassmorphism card */}
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-3xl p-6 border border-slate-800/50 shadow-xl">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300 text-sm font-medium">
                Correo electrónico
              </Label>
              <div className="relative group">
                <div className="absolute inset-0 bg-primary/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-primary transition-colors z-10" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="relative pl-12 h-14 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/30 rounded-xl text-base"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300 text-sm font-medium">
                Contraseña
              </Label>
              <div className="relative group">
                <div className="absolute inset-0 bg-primary/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-primary transition-colors z-10" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="relative pl-12 h-14 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/30 rounded-xl text-base"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-14 mt-6 bg-gradient-to-r from-primary via-primary to-emerald-500 hover:opacity-90 text-white font-semibold text-lg rounded-xl shadow-lg shadow-primary/30 transition-all active:scale-[0.98]"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Ingresando...
              </span>
            ) : (
              'Iniciar Sesión'
            )}
          </Button>
        </div>
      </form>

      {/* Footer */}
      <p 
        className={`relative z-10 mt-10 text-slate-600 text-xs text-center transition-all duration-700 delay-500 ${
          showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        © {new Date().getFullYear()} GeoLogic. Todos los derechos reservados.
      </p>
    </div>
  );
}
