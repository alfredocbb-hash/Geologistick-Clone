import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardDescription } from "@/components/ui/card";
import { Loader2, Mail, Lock, MapPin, Truck, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import geologistickLogo from "@/assets/geologistick-logo.png";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/i18n/LanguageSelector";

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextParam = searchParams.get("next");
  const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;
  const { toast } = useToast();
  const { t } = useTranslation('auth');

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
        title: t('login.error'),
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: t('login.welcome'),
        description: t('login.welcomeMessage'),
      });
      if (safeNext) {
        window.location.href = safeNext;
      } else {
        navigate("/dashboard");
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -left-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}
        />
        
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
        {/* Language Selector - top right */}
        <div className="flex justify-end">
          <LanguageSelector variant="ghost" className="text-slate-400 hover:text-white" />
        </div>

        {/* Logo & Title */}
        <div 
          className={`text-center space-y-4 transition-all duration-700 ${
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="relative mx-auto w-fit">
            <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-xl animate-pulse" />
            <img 
              src={geologistickLogo} 
              alt="Geologistick" 
              className="relative w-20 h-20 mx-auto rounded-2xl object-contain shadow-2xl shadow-primary/40 transform hover:scale-105 transition-transform"
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Geologistick</h1>
          <p className="text-slate-400">{t('login.systemName')}</p>
        </div>

        {/* Login Card */}
        <Card 
          className={`shadow-xl border-slate-800/50 bg-slate-900/60 backdrop-blur-xl transition-all duration-700 delay-200 ${
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <CardHeader className="pb-4 text-center">
            <h2 className="text-xl font-semibold text-white">{t('login.title')}</h2>
            <CardDescription className="text-slate-400">
              {t('login.subtitle')}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-slate-300">{t('login.email')}</Label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-primary/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors z-10" />
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    placeholder={t('login.emailPlaceholder')}
                    className="relative pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/30"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-slate-300">{t('login.password')}</Label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-primary/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors z-10" />
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    placeholder={t('login.passwordPlaceholder')}
                    className="relative pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/30"
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-primary via-primary to-emerald-500 hover:opacity-90 text-white font-semibold shadow-lg shadow-primary/30 transition-all active:scale-[0.98]" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('login.submitting')}
                  </>
                ) : (
                  t('login.submit')
                )}
              </Button>
              
              <div className="text-center">
                <p className="text-sm text-slate-400">
                  {t('login.noAccount')}{" "}
                  <Link 
                    to="/#pricing" 
                    className="text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1"
                  >
                    {t('login.requestTrial')}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </p>
              </div>
            </CardFooter>
          </form>
        </Card>

        <p 
          className={`text-center text-sm text-slate-600 transition-all duration-700 delay-500 ${
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {t('login.copyright')}
        </p>
      </div>
    </div>
  );
}
